import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Expense = {
  id: string;
  organization_id: string;
  user_id: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  expense_date: string;
  payment_method: string | null;
  status: "pending" | "approved" | "reimbursed" | "rejected";
  company_id: string | null;
  deal_id: string | null;
  receipt_url: string | null;
  notes: string | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
};

export const listExpenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        status: z.enum(["all", "pending", "approved", "reimbursed", "rejected"]).default("all"),
        scope: z.enum(["all", "mine"]).default("all"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("expenses")
      .select("id, organization_id, user_id, category, description, amount, currency, expense_date, payment_method, status, company_id, deal_id, receipt_url, notes, decided_at, decided_by, created_at")
      .eq("organization_id", data.organization_id)
      .order("expense_date", { ascending: false })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.scope === "mine") q = q.eq("user_id", userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const totals = { pending: 0, approved: 0, reimbursed: 0, rejected: 0, all: 0 };
    for (const r of rows ?? []) {
      const a = Number(r.amount) || 0;
      totals.all += a;
      totals[r.status as keyof typeof totals] += a;
    }
    return { expenses: (rows ?? []) as Expense[], totals };
  });

export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organization_id: z.string().uuid(),
        category: z.enum(["travel", "meals", "lodging", "software", "marketing", "supplies", "other"]),
        description: z.string().min(1).max(500),
        amount: z.number().min(0).max(1e12),
        currency: z.string().max(8).default("BRL"),
        expense_date: z.string(),
        payment_method: z.enum(["cash", "credit_card", "debit_card", "transfer", "pix", "other"]).nullable().optional(),
        company_id: z.string().uuid().nullable().optional(),
        deal_id: z.string().uuid().nullable().optional(),
        receipt_url: z.string().url().max(1000).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = { ...data };
    if (!payload.id) payload.user_id = userId;
    const { data: row, error } = await supabase
      .from("expenses")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const decideExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["approved", "rejected", "reimbursed"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("expenses")
      .update({
        status: data.status,
        decided_by: userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
