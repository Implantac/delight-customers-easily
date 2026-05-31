import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const periodInput = z.object({
  organization_id: z.string().uuid(),
  period_month: z.string().regex(/^\d{4}-\d{2}$/),
});

/** Recomputa o relatório a partir de regras + deals + metas e materializa em commission_payouts */
export const generatePayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => periodInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
        .select("id, value, user_id, closed_at")
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

    const rule = rulesRes.data;
    if (!rule) throw new Error("Nenhuma regra de comissão ativa para esta organização");

    const deals = dealsRes.data ?? [];
    const memberIds = (membersRes.data ?? []).map((m: any) => m.user_id);
    const goalByUser = new Map<string, number>();
    for (const g of goalsRes.data ?? []) {
      if (g.user_id) goalByUser.set(g.user_id, Number(g.target_value || 0));
    }

    const basePct = Number(rule.base_percent || 0) / 100;
    const accelPct = Number(rule.accelerator_percent || 0) / 100;
    const quotaBonus = Number(rule.quota_bonus || 0);

    const userMap = new Map<string, { sold: number; count: number }>();
    for (const uid of memberIds) userMap.set(uid, { sold: 0, count: 0 });
    for (const d of deals) {
      if (!d.user_id) continue;
      const c = userMap.get(d.user_id) ?? { sold: 0, count: 0 };
      c.sold += Number(d.value || 0);
      c.count += 1;
      userMap.set(d.user_id, c);
    }

    const rows: any[] = [];
    for (const [uid, agg] of userMap) {
      const goal = goalByUser.get(uid) ?? 0;
      const baseCommission = agg.sold * basePct;
      const reached = goal > 0 && agg.sold >= goal;
      const excess = reached ? Math.max(0, agg.sold - goal) : 0;
      const accelerator = excess * accelPct;
      const bonus = reached ? quotaBonus : 0;
      const total = baseCommission + accelerator + bonus;
      rows.push({
        organization_id: data.organization_id,
        user_id: uid,
        period_month: periodDay,
        rule_id: rule.id,
        sold_value: Number(agg.sold.toFixed(2)),
        deals_count: agg.count,
        goal_value: Number(goal.toFixed(2)),
        base_commission: Number(baseCommission.toFixed(2)),
        accelerator: Number(accelerator.toFixed(2)),
        bonus: Number(bonus.toFixed(2)),
        total: Number(total.toFixed(2)),
        status: "open",
        created_by: userId,
      });
    }

    if (rows.length === 0) return { upserted: 0 };

    // Não sobrescreve payouts travados/pagos
    const { data: existing } = await supabase
      .from("commission_payouts")
      .select("user_id, status")
      .eq("organization_id", data.organization_id)
      .eq("period_month", periodDay);
    const locked = new Set((existing ?? []).filter((e: any) => e.status !== "open").map((e: any) => e.user_id));
    const toWrite = rows.filter((r) => !locked.has(r.user_id));

    const { error } = await supabase
      .from("commission_payouts")
      .upsert(toWrite, { onConflict: "organization_id,user_id,period_month" });
    if (error) throw new Error(error.message);
    return { upserted: toWrite.length, skipped: rows.length - toWrite.length };
  });

export const listPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => periodInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const periodDay = `${data.period_month}-01`;
    const { data: rows, error } = await supabase
      .from("commission_payouts")
      .select("*")
      .eq("organization_id", data.organization_id)
      .eq("period_month", periodDay)
      .order("total", { ascending: false });
    if (error) throw new Error(error.message);

    const userIds = (rows ?? []).map((r: any) => r.user_id);
    const profiles: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      for (const p of profs ?? []) profiles[(p as any).id] = (p as any).full_name ?? "—";
    }
    const enriched = (rows ?? []).map((r: any) => ({ ...r, name: profiles[r.user_id] ?? "—" }));
    const totals = enriched.reduce(
      (acc: any, r: any) => ({
        sold: acc.sold + Number(r.sold_value),
        commission: acc.commission + Number(r.total),
        count: acc.count + r.deals_count,
      }),
      { sold: 0, commission: 0, count: 0 }
    );
    return { payouts: enriched, totals };
  });

const setStatus = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "locked", "paid"]),
  notes: z.string().max(2000).optional(),
});
export const setPayoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => setStatus.parse(i))
  .handler(async ({ data, context }) => {
    const patch: any = { status: data.status, notes: data.notes ?? null };
    if (data.status === "locked") patch.locked_at = new Date().toISOString();
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await context.supabase.from("commission_payouts").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
