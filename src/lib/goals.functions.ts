import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgMonthInput = z.object({
  organization_id: z.string().uuid(),
  period_month: z.string().regex(/^\d{4}-\d{2}$/),
});

export type LeaderboardRow = {
  user_id: string;
  user_name: string;
  target_value: number;
  achieved_value: number;
  deals_won: number;
  progress: number;
  rank: number;
};

export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgMonthInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [year, month] = data.period_month.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const periodDay = `${data.period_month}-01`;

    const [goalsRes, dealsRes, membersRes] = await Promise.all([
      supabase
        .from("sales_goals")
        .select("user_id, target_value")
        .eq("organization_id", data.organization_id)
        .eq("period_month", periodDay),
      supabase
        .from("deals")
        .select("id, value, user_id, closed_at")
        .eq("organization_id", data.organization_id)
        .eq("stage", "won")
        .gte("closed_at", start.toISOString())
        .lt("closed_at", end.toISOString()),
      supabase
        .from("memberships")
        .select("user_id")
        .eq("organization_id", data.organization_id),
    ]);

    const memberIds = (membersRes.data ?? []).map((m: any) => m.user_id);
    let profilesMap = new Map<string, string>();
    if (memberIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", memberIds);
      for (const p of profs ?? []) {
        profilesMap.set(p.id, p.full_name || p.email || "Usuário");
      }
    }

    const goalByUser = new Map<string, number>();
    for (const g of goalsRes.data ?? []) {
      goalByUser.set(g.user_id as string, Number(g.target_value));
    }

    const achievedByUser = new Map<string, { value: number; count: number }>();
    for (const d of dealsRes.data ?? []) {
      const uid = d.user_id as string | null;
      if (!uid) continue;
      const cur = achievedByUser.get(uid) ?? { value: 0, count: 0 };
      cur.value += Number(d.value ?? 0);
      cur.count += 1;
      achievedByUser.set(uid, cur);
    }

    const userIds = new Set<string>([
      ...memberIds,
      ...goalByUser.keys(),
      ...achievedByUser.keys(),
    ]);

    const rows: LeaderboardRow[] = Array.from(userIds).map((uid) => {
      const target = goalByUser.get(uid) ?? 0;
      const ach = achievedByUser.get(uid) ?? { value: 0, count: 0 };
      const progress = target > 0 ? (ach.value / target) * 100 : 0;
      return {
        user_id: uid,
        user_name: profilesMap.get(uid) ?? "Usuário",
        target_value: target,
        achieved_value: ach.value,
        deals_won: ach.count,
        progress,
        rank: 0,
      };
    });

    rows.sort((a, b) => b.achieved_value - a.achieved_value);
    rows.forEach((r, i) => (r.rank = i + 1));

    return { rows };
  });

export const listGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgMonthInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const periodDay = `${data.period_month}-01`;
    const { data: goals } = await supabase
      .from("sales_goals")
      .select("id, user_id, target_value, period_month")
      .eq("organization_id", data.organization_id)
      .eq("period_month", periodDay);
    return { goals: goals ?? [] };
  });

export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        user_id: z.string().uuid(),
        period_month: z.string().regex(/^\d{4}-\d{2}$/),
        target_value: z.number().min(0).max(1_000_000_000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const periodDay = `${data.period_month}-01`;
    const { error } = await supabase.from("sales_goals").upsert(
      {
        organization_id: data.organization_id,
        user_id: data.user_id,
        period_month: periodDay,
        target_value: data.target_value,
        created_by: userId,
      },
      { onConflict: "organization_id,user_id,period_month" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("sales_goals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
