import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Subscription = {
  id: string;
  company_id: string | null;
  contact_id: string | null;
  plan_name: string;
  mrr: number;
  currency: string;
  billing_cycle: "monthly" | "quarterly" | "yearly";
  start_date: string;
  renewal_date: string;
  status: "active" | "cancelled" | "paused" | "expired";
  notes: string | null;
  companies?: { id: string; name: string } | null;
  contacts?: { id: string; first_name: string | null; last_name: string | null } | null;
};

export const listSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        status: z.enum(["all", "active", "cancelled", "paused", "expired"]).default("all"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("subscriptions")
      .select("id, company_id, contact_id, plan_name, mrr, currency, billing_cycle, start_date, renewal_date, status, notes")
      .eq("organization_id", data.organization_id)
      .order("renewal_date", { ascending: true })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: subs, error } = await q;
    if (error) throw new Error(error.message);

    const companyIds = Array.from(new Set((subs ?? []).map((s) => s.company_id).filter(Boolean) as string[]));
    const contactIds = Array.from(new Set((subs ?? []).map((s) => s.contact_id).filter(Boolean) as string[]));

    const [companiesRes, contactsRes] = await Promise.all([
      companyIds.length
        ? supabase.from("companies").select("id, name").in("id", companyIds)
        : Promise.resolve({ data: [] as any[] }),
      contactIds.length
        ? supabase.from("contacts").select("id, first_name, last_name").in("id", contactIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const companiesById: Record<string, any> = {};
    (companiesRes.data ?? []).forEach((c: any) => (companiesById[c.id] = c));
    const contactsById: Record<string, any> = {};
    (contactsRes.data ?? []).forEach((c: any) => (contactsById[c.id] = c));

    const enriched = (subs ?? []).map((s) => ({
      ...s,
      mrr: Number(s.mrr),
      companies: s.company_id ? companiesById[s.company_id] ?? null : null,
      contacts: s.contact_id ? contactsById[s.contact_id] ?? null : null,
    })) as Subscription[];

    // KPIs (across active only)
    const active = enriched.filter((s) => s.status === "active");
    const mrr = active.reduce((sum, s) => {
      if (s.billing_cycle === "monthly") return sum + s.mrr;
      if (s.billing_cycle === "quarterly") return sum + s.mrr / 3;
      if (s.billing_cycle === "yearly") return sum + s.mrr / 12;
      return sum;
    }, 0);
    const arr = mrr * 12;

    const today = new Date();
    const in30 = new Date(today);
    in30.setDate(today.getDate() + 30);
    const renewingSoon = active.filter((s) => {
      const r = new Date(s.renewal_date);
      return r >= today && r <= in30;
    }).length;
    const overdue = active.filter((s) => new Date(s.renewal_date) < today).length;

    return {
      subscriptions: enriched,
      kpis: { mrr, arr, count: active.length, renewingSoon, overdue },
    };
  });

export const upsertSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organization_id: z.string().uuid(),
        company_id: z.string().uuid().nullable().optional(),
        contact_id: z.string().uuid().nullable().optional(),
        plan_name: z.string().min(1).max(160),
        mrr: z.number().min(0).max(10_000_000),
        currency: z.string().min(3).max(8).default("BRL"),
        billing_cycle: z.enum(["monthly", "quarterly", "yearly"]),
        start_date: z.string(),
        renewal_date: z.string(),
        status: z.enum(["active", "cancelled", "paused", "expired"]),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          company_id: data.company_id ?? null,
          contact_id: data.contact_id ?? null,
          plan_name: data.plan_name,
          mrr: data.mrr,
          currency: data.currency,
          billing_cycle: data.billing_cycle,
          start_date: data.start_date,
          renewal_date: data.renewal_date,
          status: data.status,
          notes: data.notes ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("subscriptions")
      .insert({
        organization_id: data.organization_id,
        company_id: data.company_id ?? null,
        contact_id: data.contact_id ?? null,
        plan_name: data.plan_name,
        mrr: data.mrr,
        currency: data.currency,
        billing_cycle: data.billing_cycle,
        start_date: data.start_date,
        renewal_date: data.renewal_date,
        status: data.status,
        notes: data.notes ?? null,
        created_by: userId!,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("subscriptions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renewSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sub, error: getErr } = await supabase
      .from("subscriptions")
      .select("renewal_date, billing_cycle")
      .eq("id", data.id)
      .single();
    if (getErr) throw new Error(getErr.message);
    const next = new Date(sub.renewal_date);
    if (sub.billing_cycle === "monthly") next.setMonth(next.getMonth() + 1);
    else if (sub.billing_cycle === "quarterly") next.setMonth(next.getMonth() + 3);
    else next.setFullYear(next.getFullYear() + 1);
    const { error } = await supabase
      .from("subscriptions")
      .update({ renewal_date: next.toISOString().slice(0, 10), status: "active" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, renewal_date: next.toISOString().slice(0, 10) };
  });
