import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function tierFor(total: number): string {
  if (total >= 50000) return "platina";
  if (total >= 15000) return "ouro";
  if (total >= 5000) return "prata";
  return "bronze";
}

export const listLoyalty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [accountsRes, rewardsRes, txRes] = await Promise.all([
      supabase.from("loyalty_accounts").select("*").eq("organization_id", data.organization_id).order("balance", { ascending: false }).limit(500),
      supabase.from("loyalty_rewards").select("*").eq("organization_id", data.organization_id).order("cost_points"),
      supabase.from("loyalty_transactions").select("*").eq("organization_id", data.organization_id).order("created_at", { ascending: false }).limit(200),
    ]);
    if (accountsRes.error) throw new Error(accountsRes.error.message);
    if (rewardsRes.error) throw new Error(rewardsRes.error.message);
    if (txRes.error) throw new Error(txRes.error.message);

    const accounts = accountsRes.data ?? [];
    const totals = {
      members: accounts.length,
      total_balance: accounts.reduce((s, a: any) => s + (a.balance ?? 0), 0),
      total_earned: accounts.reduce((s, a: any) => s + (a.total_earned ?? 0), 0),
      total_redeemed: accounts.reduce((s, a: any) => s + (a.total_redeemed ?? 0), 0),
      by_tier: {
        bronze: accounts.filter((a: any) => a.tier === "bronze").length,
        prata: accounts.filter((a: any) => a.tier === "prata").length,
        ouro: accounts.filter((a: any) => a.tier === "ouro").length,
        platina: accounts.filter((a: any) => a.tier === "platina").length,
      },
    };
    return { accounts, rewards: rewardsRes.data ?? [], transactions: txRes.data ?? [], totals };
  });

export const enrollContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; contact_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: existing } = await supabase
      .from("loyalty_accounts")
      .select("id")
      .eq("organization_id", data.organization_id)
      .eq("contact_id", data.contact_id)
      .maybeSingle();
    if (existing) return { id: existing.id, already: true };
    const { data: row, error } = await supabase
      .from("loyalty_accounts")
      .insert({ organization_id: data.organization_id, contact_id: data.contact_id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id, already: false };
  });

export const recordPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    account_id: string;
    kind: "earn" | "redeem" | "adjust" | "expire";
    points: number;
    reason?: string | null;
    reference?: string | null;
    reward_id?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: acc, error: accErr } = await supabase
      .from("loyalty_accounts")
      .select("id, contact_id, balance, total_earned, total_redeemed")
      .eq("id", data.account_id)
      .single();
    if (accErr) throw new Error(accErr.message);

    const pts = Math.abs(Math.floor(data.points));
    let delta = 0;
    let earnedDelta = 0;
    let redeemedDelta = 0;
    if (data.kind === "earn") { delta = pts; earnedDelta = pts; }
    else if (data.kind === "redeem") {
      if (pts > (acc!.balance ?? 0)) throw new Error("Saldo insuficiente");
      delta = -pts; redeemedDelta = pts;
    }
    else if (data.kind === "adjust") { delta = data.points; }
    else if (data.kind === "expire") { delta = -pts; }

    const newBalance = (acc!.balance ?? 0) + delta;
    const newEarned = (acc!.total_earned ?? 0) + earnedDelta;
    const newRedeemed = (acc!.total_redeemed ?? 0) + redeemedDelta;
    const newTier = tierFor(newEarned);

    const { error: updErr } = await supabase
      .from("loyalty_accounts")
      .update({ balance: newBalance, total_earned: newEarned, total_redeemed: newRedeemed, tier: newTier })
      .eq("id", data.account_id);
    if (updErr) throw new Error(updErr.message);

    const { error: txErr } = await supabase.from("loyalty_transactions").insert({
      organization_id: data.organization_id,
      account_id: data.account_id,
      contact_id: acc!.contact_id,
      kind: data.kind,
      points: delta,
      reason: data.reason ?? null,
      reference: data.reference ?? null,
      reward_id: data.reward_id ?? null,
      created_by: userId,
    });
    if (txErr) throw new Error(txErr.message);

    return { balance: newBalance, tier: newTier };
  });

export const upsertReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    name: string;
    description?: string | null;
    cost_points: number;
    stock?: number | null;
    active?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload: any = {
      organization_id: data.organization_id,
      name: data.name,
      description: data.description ?? null,
      cost_points: Math.max(0, Math.floor(data.cost_points)),
      stock: data.stock ?? null,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await supabase.from("loyalty_rewards").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("loyalty_rewards").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const deleteReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("loyalty_rewards").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; account_id: string; reward_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: reward, error: rErr } = await supabase
      .from("loyalty_rewards")
      .select("id, name, cost_points, stock, active")
      .eq("id", data.reward_id)
      .single();
    if (rErr) throw new Error(rErr.message);
    if (!reward!.active) throw new Error("Recompensa inativa");
    if (reward!.stock !== null && reward!.stock <= 0) throw new Error("Recompensa sem estoque");

    const { data: acc, error: aErr } = await supabase
      .from("loyalty_accounts")
      .select("id, contact_id, balance, total_redeemed, total_earned")
      .eq("id", data.account_id)
      .single();
    if (aErr) throw new Error(aErr.message);
    if ((acc!.balance ?? 0) < reward!.cost_points) throw new Error("Saldo insuficiente para resgate");

    const newBalance = acc!.balance - reward!.cost_points;
    const newRedeemed = (acc!.total_redeemed ?? 0) + reward!.cost_points;

    await supabase.from("loyalty_accounts")
      .update({ balance: newBalance, total_redeemed: newRedeemed, tier: tierFor(acc!.total_earned ?? 0) })
      .eq("id", data.account_id);

    if (reward!.stock !== null) {
      await supabase.from("loyalty_rewards").update({ stock: reward!.stock - 1 }).eq("id", reward!.id);
    }

    await supabase.from("loyalty_transactions").insert({
      organization_id: data.organization_id,
      account_id: data.account_id,
      contact_id: acc!.contact_id,
      kind: "redeem",
      points: -reward!.cost_points,
      reason: `Resgate: ${reward!.name}`,
      reward_id: reward!.id,
    });

    return { balance: newBalance, reward: reward!.name };
  });
