import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAGE_PROB: Record<string, number> = {
  lead: 10, qualified: 30, proposal: 55, negotiation: 75, won: 100, lost: 0,
};

const orgInput = z.object({ organization_id: z.string().uuid() });

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthDate(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

// -------- Forecast ponderado por mês + comparação com meta --------
export const getForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const [dealsRes, goalsRes, profilesRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, title, value, stage, expected_close, user_id, updated_at")
        .eq("organization_id", org),
      supabase
        .from("sales_goals")
        .select("id, user_id, period_month, target_value")
        .eq("organization_id", org),
      supabase
        .from("profiles")
        .select("id, full_name"),
    ]);

    const deals = dealsRes.data ?? [];
    const goals = goalsRes.data ?? [];
    const profiles = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p.full_name ?? "Sem nome"]));

    // Próximos 6 meses incluindo o atual
    const today = new Date();
    const months: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + i, 1));
      months.push(monthKey(d));
    }

    type Bucket = { month: string; committed: number; weighted: number; best: number; won: number; target: number };
    const byMonth = new Map<string, Bucket>();
    months.forEach((m) => byMonth.set(m, { month: m, committed: 0, weighted: 0, best: 0, won: 0, target: 0 }));

    for (const d of deals as any[]) {
      const value = Number(d.value) || 0;
      const stage = d.stage as string;
      const prob = STAGE_PROB[stage] ?? 10;
      const close = d.expected_close ? new Date(d.expected_close) : null;
      const key = close ? monthKey(close) : monthKey(today);
      const b = byMonth.get(key);
      if (!b) continue;

      if (stage === "won") {
        b.won += value;
      } else if (stage !== "lost") {
        b.weighted += value * (prob / 100);
        b.best += value;
        if (prob >= 75) b.committed += value;
      }
    }

    // Metas agregadas por mês (somando todas as metas individuais + meta da org)
    for (const g of goals as any[]) {
      const key = monthKey(new Date(g.period_month));
      const b = byMonth.get(key);
      if (b) b.target += Number(g.target_value) || 0;
    }

    const series = months.map((m) => byMonth.get(m)!);

    // Gap-to-goal por vendedor (mês corrente)
    const currentKey = months[0];
    const currentMonthStart = monthDate(currentKey);
    const nextMonthStart = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() + 1, 1));

    type RepRow = { user_id: string; name: string; target: number; won: number; weighted: number; gap: number; attainment: number };
    const reps = new Map<string, RepRow>();

    const ensureRep = (uid: string | null | undefined): RepRow | null => {
      if (!uid) return null;
      if (!reps.has(uid)) {
        reps.set(uid, {
          user_id: uid,
          name: profiles.get(uid) ?? "Sem nome",
          target: 0, won: 0, weighted: 0, gap: 0, attainment: 0,
        });
      }
      return reps.get(uid)!;
    };

    for (const g of goals as any[]) {
      if (!g.user_id) continue;
      const gMonth = monthKey(new Date(g.period_month));
      if (gMonth !== currentKey) continue;
      const r = ensureRep(g.user_id);
      if (r) r.target += Number(g.target_value) || 0;
    }

    for (const d of deals as any[]) {
      const close = d.expected_close ? new Date(d.expected_close) : null;
      const inCurrent = close && close >= currentMonthStart && close < nextMonthStart;
      if (!inCurrent && d.stage !== "won") continue;
      if (d.stage === "won") {
        const updated = new Date(d.updated_at);
        if (updated < currentMonthStart || updated >= nextMonthStart) continue;
      }
      const r = ensureRep(d.user_id);
      if (!r) continue;
      const value = Number(d.value) || 0;
      const prob = STAGE_PROB[d.stage] ?? 10;
      if (d.stage === "won") r.won += value;
      else if (d.stage !== "lost") r.weighted += value * (prob / 100);
    }

    const repRows = Array.from(reps.values()).map((r) => {
      const projected = r.won + r.weighted;
      const gap = Math.max(0, r.target - projected);
      const attainment = r.target > 0 ? Math.round((projected / r.target) * 100) : 0;
      return { ...r, gap, attainment };
    }).sort((a, b) => b.target - a.target);

    const totals = series[0];
    const projected = totals.won + totals.weighted;
    const gap = Math.max(0, totals.target - projected);

    return {
      months: series,
      current: {
        month: currentKey,
        target: totals.target,
        won: totals.won,
        weighted: totals.weighted,
        committed: totals.committed,
        best: totals.best,
        projected,
        gap,
        attainment: totals.target > 0 ? Math.round((projected / totals.target) * 100) : 0,
      },
      reps: repRows,
    };
  });

// -------- Listar metas --------
export const listGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("sales_goals")
      .select("id, user_id, period_month, target_value")
      .eq("organization_id", data.organization_id)
      .order("period_month", { ascending: false });
    if (error) throw new Error(error.message);
    return { goals: rows ?? [] };
  });

// -------- Criar/atualizar meta --------
export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      user_id: z.string().uuid().nullable(),
      period_month: z.string().regex(/^\d{4}-\d{2}$/),
      target_value: z.number().min(0).max(1_000_000_000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const period = `${data.period_month}-01`;
    const { error } = await supabase
      .from("sales_goals")
      .upsert(
        {
          organization_id: data.organization_id,
          user_id: data.user_id,
          period_month: period,
          target_value: data.target_value,
          created_by: userId,
        },
        { onConflict: "organization_id,user_id,period_month" },
      );
    if (error) throw new Error(error.message);
    return { success: true };
  });

// -------- Deletar meta --------
export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("sales_goals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
