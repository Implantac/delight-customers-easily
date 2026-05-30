import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const monthInput = z.object({
  organization_id: z.string().uuid(),
  period_month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const getCommissionReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => monthInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [year, month] = data.period_month.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const periodDay = `${data.period_month}-01`;

    const [rulesRes, dealsRes, goalsRes, membersRes] = await Promise.all([
      supabase
        .from("commission_rules")
        .select("*")
        .eq("organization_id", data.organization_id)
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("deals")
        .select("id, title, value, user_id, closed_at")
        .eq("organization_id", data.organization_id)
        .eq("stage", "won")
        .gte("closed_at", start.toISOString())
        .lt("closed_at", end.toISOString()),
      supabase
        .from("sales_goals")
        .select("user_id, target_value")
        .eq("organization_id", data.organization_id)
        .eq("period_month", periodDay),
      supabase
        .from("memberships")
        .select("user_id")
        .eq("organization_id", data.organization_id),
    ]);

    const rule = rulesRes.data ?? {
      id: null,
      name: "Sem regra ativa",
      base_percent: 0,
      accelerator_percent: 0,
      quota_bonus: 0,
    };
    const deals = dealsRes.data ?? [];
    const goals = goalsRes.data ?? [];
    const memberIds = (membersRes.data ?? []).map((m: any) => m.user_id);

    const goalByUser = new Map<string, number>();
    let orgGoal = 0;
    for (const g of goals) {
      if (g.user_id) goalByUser.set(g.user_id, Number(g.target_value || 0));
      else orgGoal = Number(g.target_value || 0);
    }

    const profiles: Record<string, string> = {};
    if (memberIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds);
      for (const p of profs ?? []) profiles[p.id] = (p as any).full_name ?? "—";
    }

    const basePct = Number(rule.base_percent || 0) / 100;
    const accelPct = Number(rule.accelerator_percent || 0) / 100;
    const quotaBonus = Number(rule.quota_bonus || 0);

    const userMap = new Map<string, { user_id: string; name: string; sold: number; deals: number; goal: number }>();
    for (const uid of memberIds) {
      userMap.set(uid, { user_id: uid, name: profiles[uid] ?? "—", sold: 0, deals: 0, goal: goalByUser.get(uid) ?? 0 });
    }
    for (const d of deals) {
      const uid = d.user_id;
      if (!uid) continue;
      const cur = userMap.get(uid) ?? { user_id: uid, name: profiles[uid] ?? "—", sold: 0, deals: 0, goal: goalByUser.get(uid) ?? 0 };
      cur.sold += Number(d.value || 0);
      cur.deals += 1;
      userMap.set(uid, cur);
    }

    const rows = Array.from(userMap.values()).map((u) => {
      const baseCommission = u.sold * basePct;
      const reachedQuota = u.goal > 0 && u.sold >= u.goal;
      const excess = reachedQuota ? Math.max(0, u.sold - u.goal) : 0;
      const accelerator = excess * accelPct;
      const bonus = reachedQuota ? quotaBonus : 0;
      const total = baseCommission + accelerator + bonus;
      const attainment = u.goal > 0 ? u.sold / u.goal : null;
      return {
        ...u,
        baseCommission,
        accelerator,
        bonus,
        total,
        attainment,
        reachedQuota,
      };
    }).sort((a, b) => b.total - a.total);

    const totals = rows.reduce(
      (acc, r) => ({
        sold: acc.sold + r.sold,
        deals: acc.deals + r.deals,
        total: acc.total + r.total,
      }),
      { sold: 0, deals: 0, total: 0 }
    );

    return { rule, rows, totals, orgGoal, period: data.period_month };
  });

const upsertRule = z.object({
  organization_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  base_percent: z.number().min(0).max(100),
  accelerator_percent: z.number().min(0).max(100),
  quota_bonus: z.number().min(0).max(10_000_000),
  active: z.boolean().default(true),
});

export const upsertCommissionRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertRule.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      organization_id: data.organization_id,
      name: data.name,
      base_percent: data.base_percent,
      accelerator_percent: data.accelerator_percent,
      quota_bonus: data.quota_bonus,
      active: data.active,
      created_by: userId,
    };
    if (data.id) {
      const { error } = await supabase.from("commission_rules").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    // Desativa outras regras antes (apenas uma ativa por org)
    if (data.active) {
      await supabase
        .from("commission_rules")
        .update({ active: false })
        .eq("organization_id", data.organization_id)
        .eq("active", true);
    }
    const { data: ins, error } = await supabase.from("commission_rules").insert(payload).select("id").single();
    if (error) throw error;
    return { id: ins!.id };
  });

export const listCommissionRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rules, error } = await context.supabase
      .from("commission_rules")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { rules: rules ?? [] };
  });
