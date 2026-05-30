import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BankAccount = {
  id: string;
  organization_id: string;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  currency: string;
  opening_balance: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BankTx = {
  id: string;
  organization_id: string;
  account_id: string;
  occurred_at: string;
  description: string;
  amount: number;
  counterparty: string | null;
  category: string | null;
  reconciled: boolean;
  invoice_id: string | null;
  expense_id: string | null;
  notes: string | null;
  created_at: string;
};

export const listBanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      account_id: z.string().uuid().optional(),
      reconciled: z.enum(["all", "yes", "no"]).default("all"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: accounts, error: e1 }, txRes] = await Promise.all([
      supabase
        .from("bank_accounts")
        .select("*")
        .eq("organization_id", data.organization_id)
        .order("created_at", { ascending: true }),
      (async () => {
        let q = supabase
          .from("bank_transactions")
          .select("*")
          .eq("organization_id", data.organization_id)
          .order("occurred_at", { ascending: false })
          .limit(1000);
        if (data.account_id) q = q.eq("account_id", data.account_id);
        if (data.reconciled === "yes") q = q.eq("reconciled", true);
        if (data.reconciled === "no") q = q.eq("reconciled", false);
        return await q;
      })(),
    ]);
    if (e1) throw new Error(e1.message);
    if (txRes.error) throw new Error(txRes.error.message);

    const accs = (accounts ?? []) as BankAccount[];
    const txs = (txRes.data ?? []) as BankTx[];

    // computa saldo por conta
    const balances: Record<string, { balance: number; inflow: number; outflow: number; pending: number }> = {};
    for (const a of accs) balances[a.id] = { balance: Number(a.opening_balance) || 0, inflow: 0, outflow: 0, pending: 0 };
    for (const t of txs) {
      const b = balances[t.account_id];
      if (!b) continue;
      const amt = Number(t.amount) || 0;
      b.balance += amt;
      if (amt >= 0) b.inflow += amt;
      else b.outflow += Math.abs(amt);
      if (!t.reconciled) b.pending += 1;
    }

    const totals = {
      accounts: accs.length,
      transactions: txs.length,
      total_balance: Object.values(balances).reduce((s, b) => s + b.balance, 0),
      total_inflow: Object.values(balances).reduce((s, b) => s + b.inflow, 0),
      total_outflow: Object.values(balances).reduce((s, b) => s + b.outflow, 0),
      unreconciled: txs.filter((t) => !t.reconciled).length,
    };

    return { accounts: accs, transactions: txs, balances, totals };
  });

export const upsertAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      organization_id: z.string().uuid(),
      name: z.string().min(1).max(120),
      bank_name: z.string().max(120).nullable().optional(),
      account_number: z.string().max(60).nullable().optional(),
      currency: z.string().min(3).max(3).default("BRL"),
      opening_balance: z.number().default(0),
      is_active: z.boolean().default(true),
      notes: z.string().max(2000).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = { ...data };
    const { data: row, error } = data.id
      ? await supabase.from("bank_accounts").update(payload).eq("id", data.id).select("*").single()
      : await supabase.from("bank_accounts").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row as BankAccount;
  });

export const upsertTx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      organization_id: z.string().uuid(),
      account_id: z.string().uuid(),
      occurred_at: z.string().min(10).max(10),
      description: z.string().min(1).max(500),
      amount: z.number(),
      counterparty: z.string().max(200).nullable().optional(),
      category: z.string().max(80).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = { ...data };
    const { data: row, error } = data.id
      ? await supabase.from("bank_transactions").update(payload).eq("id", data.id).select("*").single()
      : await supabase.from("bank_transactions").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row as BankTx;
  });

export const toggleReconciled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      reconciled: z.boolean(),
      invoice_id: z.string().uuid().nullable().optional(),
      expense_id: z.string().uuid().nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("bank_transactions")
      .update({
        reconciled: data.reconciled,
        invoice_id: data.invoice_id ?? null,
        expense_id: data.expense_id ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("bank_transactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
