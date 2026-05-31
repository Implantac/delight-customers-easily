import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgIn = z.object({ organization_id: z.string().uuid() });

/**
 * Leaderboard de coaching: agrega métricas por rep dentro da organização.
 * - Negócios won / pipeline aberto / atividades nos últimos 30 dias
 * - Aderência à meta do mês corrente
 * - Score composto (0-100) usado para ranking
 */
export const getCoachingLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgIn.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date();
    const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const endMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
    const periodDay = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

    const [membersRes, dealsOpenRes, dealsWonRes, actsRes, goalsRes] = await Promise.all([
      supabase.from("memberships").select("user_id, role").eq("organization_id", data.organization_id),
      supabase
        .from("deals")
        .select("user_id, value, stage, updated_at")
        .eq("organization_id", data.organization_id)
        .not("stage", "in", "(won,lost)"),
      supabase
        .from("deals")
        .select("user_id, value, closed_at")
        .eq("organization_id", data.organization_id)
        .eq("stage", "won")
        .gte("closed_at", startMonth)
        .lt("closed_at", endMonth),
      supabase
        .from("activities")
        .select("user_id, completed, created_at")
        .eq("organization_id", data.organization_id)
        .gte("created_at", since30),
      supabase
        .from("sales_goals")
        .select("user_id, target_value")
        .eq("organization_id", data.organization_id)
        .eq("period_month", periodDay),
    ]);

    const members = (membersRes.data ?? []) as Array<{ user_id: string; role: string }>;
    const userIds = members.map((m) => m.user_id);
    const goalByUser = new Map<string, number>();
    for (const g of goalsRes.data ?? []) {
      if (g.user_id) goalByUser.set(g.user_id, Number(g.target_value || 0));
    }

    const profiles: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      for (const p of profs ?? []) profiles[(p as any).id] = (p as any).full_name ?? "—";
    }

    type Agg = {
      user_id: string;
      name: string;
      role: string;
      pipelineOpen: number;
      pipelineCount: number;
      stalledCount: number;
      wonValue: number;
      wonCount: number;
      activities30: number;
      completedActs: number;
    };
    const map = new Map<string, Agg>();
    for (const m of members) {
      map.set(m.user_id, {
        user_id: m.user_id,
        name: profiles[m.user_id] ?? "—",
        role: m.role,
        pipelineOpen: 0,
        pipelineCount: 0,
        stalledCount: 0,
        wonValue: 0,
        wonCount: 0,
        activities30: 0,
        completedActs: 0,
      });
    }

    const nowMs = Date.now();
    for (const d of (dealsOpenRes.data ?? []) as any[]) {
      if (!d.user_id) continue;
      const a = map.get(d.user_id);
      if (!a) continue;
      a.pipelineOpen += Number(d.value || 0);
      a.pipelineCount += 1;
      const days = Math.floor((nowMs - new Date(d.updated_at).getTime()) / 86400_000);
      if (days >= 14) a.stalledCount += 1;
    }
    for (const d of (dealsWonRes.data ?? []) as any[]) {
      if (!d.user_id) continue;
      const a = map.get(d.user_id);
      if (!a) continue;
      a.wonValue += Number(d.value || 0);
      a.wonCount += 1;
    }
    for (const act of (actsRes.data ?? []) as any[]) {
      if (!act.user_id) continue;
      const a = map.get(act.user_id);
      if (!a) continue;
      a.activities30 += 1;
      if (act.completed) a.completedActs += 1;
    }

    const rows = Array.from(map.values()).map((a) => {
      const goal = goalByUser.get(a.user_id) ?? 0;
      const attainment = goal > 0 ? a.wonValue / goal : null;
      const activityScore = Math.min(40, a.activities30); // 0-40
      const wonScore = Math.min(30, a.wonCount * 6); // 0-30
      const attainmentScore = attainment != null ? Math.min(20, attainment * 20) : 10;
      const hygieneScore = a.pipelineCount > 0 ? Math.max(0, 10 - (a.stalledCount / a.pipelineCount) * 10) : 5;
      const score = Math.round(activityScore + wonScore + attainmentScore + hygieneScore);
      return {
        ...a,
        goal,
        attainment,
        score,
        stalledRate: a.pipelineCount > 0 ? a.stalledCount / a.pipelineCount : 0,
      };
    }).sort((x, y) => y.score - x.score);

    const teamTotals = rows.reduce(
      (acc, r) => ({
        wonValue: acc.wonValue + r.wonValue,
        wonCount: acc.wonCount + r.wonCount,
        pipelineOpen: acc.pipelineOpen + r.pipelineOpen,
        activities30: acc.activities30 + r.activities30,
      }),
      { wonValue: 0, wonCount: 0, pipelineOpen: 0, activities30: 0 }
    );

    return { rows, teamTotals, periodMonth: periodDay };
  });
