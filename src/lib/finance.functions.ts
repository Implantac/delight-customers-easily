import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });
const DAY = 86400000;

export const getFinanceOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const [invRes, coRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, number, amount, status, issued_at, due_date, paid_at, company_id, contact_id, deal_id, notes")
        .eq("organization_id", org)
        .order("due_date", { ascending: true }),
      supabase.from("companies").select("id, name").eq("organization_id", org),
    ]);

    const invoices = invRes.data ?? [];
    const companies = coRes.data ?? [];
    const coName = new Map(companies.map((c) => [c.id, c.name]));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    // Reclassifica "open" vencidos como overdue (sem persistir)
    const enriched = invoices.map((inv) => {
      const due = new Date(inv.due_date).getTime();
      const overdueDays = inv.status === "paid" || inv.status === "canceled"
        ? 0
        : Math.max(0, Math.floor((todayMs - due) / DAY));
      const effectiveStatus =
        inv.status === "open" && overdueDays > 0 ? "overdue" : inv.status;
      return {
        ...inv,
        amount: Number(inv.amount),
        company_name: inv.company_id ? coName.get(inv.company_id) ?? null : null,
        overdue_days: overdueDays,
        effective_status: effectiveStatus,
      };
    });

    const totals = {
      open: 0, overdue: 0, paid_30d: 0, total_outstanding: 0, count_overdue: 0,
    };
    for (const inv of enriched) {
      if (inv.effective_status === "open") {
        totals.open += inv.amount;
        totals.total_outstanding += inv.amount;
      } else if (inv.effective_status === "overdue") {
        totals.overdue += inv.amount;
        totals.total_outstanding += inv.amount;
        totals.count_overdue += 1;
      } else if (inv.effective_status === "paid" && inv.paid_at) {
        const paidMs = new Date(inv.paid_at).getTime();
        if (todayMs - paidMs <= 30 * DAY) totals.paid_30d += inv.amount;
      }
    }

    // Aging buckets
    const buckets = [
      { label: "1-15 dias", min: 1, max: 15, amount: 0, count: 0 },
      { label: "16-30 dias", min: 16, max: 30, amount: 0, count: 0 },
      { label: "31-60 dias", min: 31, max: 60, amount: 0, count: 0 },
      { label: "61-90 dias", min: 61, max: 90, amount: 0, count: 0 },
      { label: "90+ dias", min: 91, max: Infinity, amount: 0, count: 0 },
    ];
    for (const inv of enriched) {
      if (inv.effective_status !== "overdue") continue;
      const b = buckets.find((x) => inv.overdue_days >= x.min && inv.overdue_days <= x.max);
      if (b) { b.amount += inv.amount; b.count += 1; }
    }

    // Top devedores
    const byCompany = new Map<string, { name: string; amount: number; count: number; max_overdue: number }>();
    for (const inv of enriched) {
      if (inv.effective_status !== "overdue" || !inv.company_id) continue;
      const cur = byCompany.get(inv.company_id) ?? {
        name: inv.company_name ?? "—",
        amount: 0,
        count: 0,
        max_overdue: 0,
      };
      cur.amount += inv.amount;
      cur.count += 1;
      cur.max_overdue = Math.max(cur.max_overdue, inv.overdue_days);
      byCompany.set(inv.company_id, cur);
    }
    const topDebtors = [...byCompany.entries()]
      .map(([id, v]) => ({ company_id: id, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return { invoices: enriched, totals, buckets, topDebtors };
  });

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  company_id: z.string().uuid().nullish(),
  contact_id: z.string().uuid().nullish(),
  deal_id: z.string().uuid().nullish(),
  number: z.string().max(80).nullish(),
  amount: z.number().min(0),
  status: z.enum(["open", "paid", "overdue", "canceled"]),
  issued_at: z.string(),
  due_date: z.string(),
  paid_at: z.string().nullish(),
  notes: z.string().max(2000).nullish(),
});

export const upsertInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = { ...data, user_id: userId };
    if (data.id) {
      const { id, ...rest } = payload;
      const { error } = await supabase.from("invoices").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    } else {
      const { id: _omit, ...rest } = payload;
      const { data: ins, error } = await supabase.from("invoices").insert(rest).select("id").single();
      if (error) throw new Error(error.message);
      return { id: ins!.id };
    }
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

export const markInvoicePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: today })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
