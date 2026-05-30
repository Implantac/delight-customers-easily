import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listReferralPrograms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("referral_programs")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { programs: rows ?? [] };
  });

export const upsertReferralProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    name: string;
    description?: string | null;
    reward_type: "fixed" | "percent" | "credit";
    reward_value: number;
    reward_currency?: string;
    status?: "active" | "paused" | "ended";
    starts_at?: string | null;
    ends_at?: string | null;
    terms?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      organization_id: data.organization_id,
      name: data.name,
      description: data.description ?? null,
      reward_type: data.reward_type,
      reward_value: data.reward_value,
      reward_currency: data.reward_currency ?? "BRL",
      status: data.status ?? "active",
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
      terms: data.terms ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("referral_programs").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("referral_programs").insert({ ...payload, created_by: userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteReferralProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("referral_programs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listReferrals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; status?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("referrals")
      .select("*, referral_programs(name, reward_type, reward_value)")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const all = rows ?? [];
    const totals = {
      pending: all.filter((r: any) => r.status === "pending").length,
      qualified: all.filter((r: any) => r.status === "qualified").length,
      converted: all.filter((r: any) => r.status === "converted" || r.status === "paid").length,
      rejected: all.filter((r: any) => r.status === "rejected").length,
      reward_due: all
        .filter((r: any) => r.status === "converted")
        .reduce((s: number, r: any) => s + Number(r.reward_amount ?? 0), 0),
      reward_paid: all
        .filter((r: any) => r.status === "paid")
        .reduce((s: number, r: any) => s + Number(r.reward_amount ?? 0), 0),
      deal_value: all.reduce((s: number, r: any) => s + Number(r.deal_value ?? 0), 0),
    };
    return { referrals: all, totals };
  });

export const upsertReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    program_id?: string | null;
    referrer_name?: string | null;
    referrer_email?: string | null;
    referrer_contact_id?: string | null;
    referred_name: string;
    referred_email?: string | null;
    referred_phone?: string | null;
    referred_company?: string | null;
    notes?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      organization_id: data.organization_id,
      program_id: data.program_id ?? null,
      referrer_name: data.referrer_name ?? null,
      referrer_email: data.referrer_email ?? null,
      referrer_contact_id: data.referrer_contact_id ?? null,
      referred_name: data.referred_name,
      referred_email: data.referred_email ?? null,
      referred_phone: data.referred_phone ?? null,
      referred_company: data.referred_company ?? null,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("referrals").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("referrals").insert({ ...payload, created_by: userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateReferralStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    status: "pending" | "qualified" | "converted" | "rejected" | "paid";
    deal_value?: number | null;
    rejected_reason?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date().toISOString();
    const patch: any = { status: data.status };
    if (data.status === "qualified") patch.qualified_at = now;
    if (data.status === "converted") {
      patch.converted_at = now;
      if (data.deal_value != null) patch.deal_value = data.deal_value;
      // Compute reward
      const { data: ref } = await supabase
        .from("referrals").select("program_id, deal_value").eq("id", data.id).single();
      const dv = data.deal_value ?? Number(ref?.deal_value ?? 0);
      if (ref?.program_id) {
        const { data: prog } = await supabase
          .from("referral_programs").select("reward_type, reward_value").eq("id", ref.program_id).single();
        if (prog) {
          patch.reward_amount = prog.reward_type === "percent"
            ? Math.round(dv * Number(prog.reward_value) * 100) / 10000
            : Number(prog.reward_value);
        }
      }
    }
    if (data.status === "rejected") patch.rejected_reason = data.rejected_reason ?? null;
    if (data.status === "paid") patch.reward_paid_at = now;
    const { error } = await supabase.from("referrals").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("referrals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
