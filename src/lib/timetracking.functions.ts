import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    from?: string; to?: string;
    user_id?: string; deal_id?: string; ticket_id?: string;
    billable?: "all" | "billable" | "non" | "billed" | "unbilled";
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("time_entries")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("entry_date", { ascending: false })
      .limit(1000);
    if (data.from) q = q.gte("entry_date", data.from);
    if (data.to) q = q.lte("entry_date", data.to);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    if (data.deal_id) q = q.eq("deal_id", data.deal_id);
    if (data.ticket_id) q = q.eq("ticket_id", data.ticket_id);
    if (data.billable === "billable") q = q.eq("billable", true);
    if (data.billable === "non") q = q.eq("billable", false);
    if (data.billable === "billed") q = q.eq("billed", true);
    if (data.billable === "unbilled") q = q.eq("billed", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const totals = {
      entries: list.length,
      total_minutes: list.reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0),
      billable_minutes: list.filter((r: any) => r.billable).reduce((s: number, r: any) => s + (r.duration_minutes ?? 0), 0),
      total_amount: list.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0),
      unbilled_amount: list.filter((r: any) => r.billable && !r.billed).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0),
    };

    // Group per user
    const byUser: Record<string, { user_id: string; minutes: number; amount: number; count: number }> = {};
    for (const r of list as any[]) {
      const k = r.user_id;
      if (!byUser[k]) byUser[k] = { user_id: k, minutes: 0, amount: 0, count: 0 };
      byUser[k].minutes += r.duration_minutes ?? 0;
      byUser[k].amount += Number(r.amount ?? 0);
      byUser[k].count += 1;
    }
    return { entries: list, totals, by_user: Object.values(byUser) };
  });

export const upsertTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    entry_date: string;
    duration_minutes: number;
    description?: string | null;
    billable?: boolean;
    hourly_rate?: number;
    deal_id?: string | null;
    ticket_id?: string | null;
    company_id?: string | null;
    contact_id?: string | null;
    tags?: string[];
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rate = Number(data.hourly_rate ?? 0);
    const billable = data.billable ?? true;
    const amount = billable ? Math.round((data.duration_minutes / 60) * rate * 100) / 100 : 0;
    const payload: any = {
      organization_id: data.organization_id,
      entry_date: data.entry_date,
      duration_minutes: Math.max(0, Math.floor(data.duration_minutes)),
      description: data.description ?? null,
      billable,
      hourly_rate: rate,
      amount,
      deal_id: data.deal_id ?? null,
      ticket_id: data.ticket_id ?? null,
      company_id: data.company_id ?? null,
      contact_id: data.contact_id ?? null,
      tags: data.tags ?? [],
    };
    if (data.id) {
      const { error } = await supabase.from("time_entries").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("time_entries")
      .insert({ ...payload, user_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const deleteTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("time_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markTimeEntriesBilled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[]; billed: boolean }) => d)
  .handler(async ({ data, context }) => {
    if (!data.ids.length) return { updated: 0 };
    const { error, count } = await context.supabase
      .from("time_entries")
      .update({ billed: data.billed, billed_at: data.billed ? new Date().toISOString() : null }, { count: "exact" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { updated: count ?? data.ids.length };
  });
