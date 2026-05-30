import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Invoice = {
  id: string;
  organization_id: string;
  user_id: string;
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  number: string | null;
  amount: number;
  status: string;
  issued_at: string;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  companies?: { id: string; name: string } | null;
};

export const listInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        status: z.enum(["all", "open", "paid", "overdue", "void"]).default("all"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("invoices")
      .select("id, organization_id, user_id, company_id, contact_id, deal_id, number, amount, status, issued_at, due_date, paid_at, notes, companies:companies(id, name)")
      .eq("organization_id", data.organization_id)
      .order("due_date", { ascending: true })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const today = new Date().toISOString().slice(0, 10);
    let billed = 0, paid = 0, overdueAmt = 0, openAmt = 0, overdueCount = 0;
    for (const r of rows ?? []) {
      const amt = Number(r.amount) || 0;
      billed += amt;
      if (r.status === "paid") paid += amt;
      else if (r.status !== "void") {
        openAmt += amt;
        if (r.due_date < today) { overdueAmt += amt; overdueCount += 1; }
      }
    }
    return {
      invoices: (rows ?? []) as unknown as Invoice[],
      kpis: { billed, paid, openAmt, overdueAmt, overdueCount, count: rows?.length ?? 0 },
    };
  });

export const upsertInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organization_id: z.string().uuid(),
        company_id: z.string().uuid().nullable().optional(),
        contact_id: z.string().uuid().nullable().optional(),
        deal_id: z.string().uuid().nullable().optional(),
        number: z.string().max(64).nullable().optional(),
        amount: z.number().min(0).max(1e12),
        status: z.enum(["open", "paid", "overdue", "void"]),
        issued_at: z.string(),
        due_date: z.string(),
        paid_at: z.string().nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = { ...data };
    if (!payload.id) payload.user_id = userId;
    const { data: row, error } = await supabase
      .from("invoices")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const markInvoicePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);
    const { data: row, error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: today })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
