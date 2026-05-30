import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// =============================================================================
// Onda 5 — Representantes: visão consolidada por vendedor para gestores.
// Para cada rep: meta do mês, realizado, cobertura (pipeline/meta),
// pipeline aberto ponderado, atividades 7d, deal mais quente, deals parados,
// última atividade. Pensado para responder "quem precisa de ajuda HOJE?".
// =============================================================================

const STAGE_PROB: Record<string, number> = {
  lead: 10, qualified: 30, proposal: 55, negotiation: 75, won: 100, lost: 0,
};

const Input = z.object({
  organization_id: z.string().uuid(),
  period_month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export type RepRow = {
  user_id: string;
  user_name: string;
  target: number;
  achieved: number;
  attainment: number; // %
  open_value: number;
  weighted_pipeline: number;
  coverage: number; // pipeline aberto / (meta - realizado)
  deals_open: number;
  deals_won_month: number;
  stalled_count: number;
  activities_7d: number;
  last_activity_at: string | null;
  hottest_deal: { id: string; title: string; value: number; stage: string } | null;
  status: "no_track" | "behind" | "on_track" | "ahead";
};

export const getRepsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = new Date();
    const monthKey =
      data.period_month ??
      `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const [y, m] = monthKey.split("-").map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    const monthEnd = new Date(Date.UTC(y, m, 1));
    const periodDay = `${monthKey}-01`;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const twentyOneDaysAgo = new Date(Date.now() - 21 * 86_400_000).toISOString();

    const [membersRes, goalsRes, dealsRes, actsRes] = await Promise.all([
      supabase.from("memberships").select("user_id, role").eq("organization_id", org),
      supabase.from("sales_goals").select("user_id, target_value")
        .eq("organization_id", org).eq("period_month", periodDay),
      supabase.from("deals")
        .select("id, title, value, stage, user_id, updated_at, closed_at, expected_close")
        .eq("organization_id", org),
      supabase.from("activities")
        .select("user_id, created_at, completed")
        .eq("organization_id", org)
        .gte("created_at", sevenDaysAgo)
        .limit(5000),
    ]);

    const memberIds = (membersRes.data ?? []).map((m: any) => m.user_id);
    let profiles = new Map<string, string>();
    if (memberIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name").in("id", memberIds);
      for (const p of profs ?? []) profiles.set(p.id, p.full_name || "Usuário");
    }

    const targetByUser = new Map<string, number>();
    for (const g of goalsRes.data ?? []) {
      targetByUser.set(g.user_id as string, Number(g.target_value || 0));
    }

    type Agg = {
      achieved: number; open_value: number; weighted: number;
      deals_open: number; deals_won_month: number; stalled: number;
      last_activity_at: string | null; activities_7d: number;
      hottest: { id: string; title: string; value: number; stage: string } | null;
    };
    const initAgg = (): Agg => ({
      achieved: 0, open_value: 0, weighted: 0,
      deals_open: 0, deals_won_month: 0, stalled: 0,
      last_activity_at: null, activities_7d: 0, hottest: null,
    });
    const agg = new Map<string, Agg>();
    for (const id of memberIds) agg.set(id, initAgg());

    for (const d of (dealsRes.data ?? []) as any[]) {
      const uid = d.user_id as string | null;
      if (!uid) continue;
      const a = agg.get(uid) ?? initAgg();
      agg.set(uid, a);
      const v = Number(d.value || 0);
      if (d.stage === "won") {
        if (d.closed_at && new Date(d.closed_at) >= monthStart && new Date(d.closed_at) < monthEnd) {
          a.achieved += v;
          a.deals_won_month += 1;
        }
      } else if (d.stage !== "lost") {
        a.open_value += v;
        a.weighted += v * ((STAGE_PROB[d.stage] ?? 10) / 100);
        a.deals_open += 1;
        if (d.updated_at && d.updated_at < twentyOneDaysAgo) a.stalled += 1;
        if (!a.hottest || v > a.hottest.value) {
          a.hottest = { id: d.id, title: d.title, value: v, stage: d.stage };
        }
      }
    }

    for (const ac of (actsRes.data ?? []) as any[]) {
      const uid = ac.user_id as string | null;
      if (!uid) continue;
      const a = agg.get(uid) ?? initAgg();
      agg.set(uid, a);
      a.activities_7d += 1;
      if (!a.last_activity_at || ac.created_at > a.last_activity_at) {
        a.last_activity_at = ac.created_at;
      }
    }

    const rows: RepRow[] = [];
    for (const uid of agg.keys()) {
      const a = agg.get(uid)!;
      const target = targetByUser.get(uid) ?? 0;
      const attainment = target > 0 ? (a.achieved / target) * 100 : 0;
      const remaining = Math.max(0, target - a.achieved);
      const coverage = remaining > 0 ? a.open_value / remaining : a.open_value > 0 ? 999 : 0;

      // Heuristic: ahead/on_track/behind by attainment vs % do mês decorrido
      const dayOfMonth = now.getUTCDate();
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const monthProgress = (dayOfMonth / lastDay) * 100;
      let status: RepRow["status"] = "no_track";
      if (target === 0) status = "no_track";
      else if (attainment >= monthProgress + 10) status = "ahead";
      else if (attainment >= monthProgress - 10) status = "on_track";
      else status = "behind";

      rows.push({
        user_id: uid,
        user_name: profiles.get(uid) ?? "Sem nome",
        target,
        achieved: a.achieved,
        attainment,
        open_value: a.open_value,
        weighted_pipeline: a.weighted,
        coverage,
        deals_open: a.deals_open,
        deals_won_month: a.deals_won_month,
        stalled_count: a.stalled,
        activities_7d: a.activities_7d,
        last_activity_at: a.last_activity_at,
        hottest_deal: a.hottest,
        status,
      });
    }

    rows.sort((a, b) => {
      const order: Record<RepRow["status"], number> = { behind: 0, on_track: 1, no_track: 2, ahead: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.open_value - a.open_value;
    });

    const summary = {
      reps: rows.length,
      target_total: rows.reduce((s, r) => s + r.target, 0),
      achieved_total: rows.reduce((s, r) => s + r.achieved, 0),
      open_total: rows.reduce((s, r) => s + r.open_value, 0),
      behind: rows.filter((r) => r.status === "behind").length,
      ahead: rows.filter((r) => r.status === "ahead").length,
      stalled_total: rows.reduce((s, r) => s + r.stalled_count, 0),
    };

    return { period_month: monthKey, rows, summary };
  });
