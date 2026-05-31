import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Quote = {
  id: string;
  organization_id: string;
  number: number;
  title: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  status: "draft" | "sent" | "accepted" | "declined" | "expired";
  issue_date: string;
  valid_until: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteItem = {
  id: string;
  organization_id: string;
  quote_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
  position: number;
};

function recomputeTotals(items: Pick<QuoteItem, "quantity" | "unit_price" | "discount_pct">[], discount = 0, tax = 0) {
  const subtotal = items.reduce((s, i) => {
    const gross = Number(i.quantity) * Number(i.unit_price);
    const net = gross * (1 - Number(i.discount_pct) / 100);
    return s + net;
  }, 0);
  const total = Math.max(0, subtotal - Number(discount) + Number(tax));
  return { subtotal: Math.round(subtotal * 100) / 100, total: Math.round(total * 100) / 100 };
}

export const listQuotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      status: z.enum(["all", "draft", "sent", "accepted", "declined", "expired"]).default("all"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("quotes").select("*").eq("organization_id", data.organization_id).order("number", { ascending: false }).limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const quotes = (rows ?? []) as Quote[];
    const totals = {
      count: quotes.length,
      draft: quotes.filter((q) => q.status === "draft").length,
      sent: quotes.filter((q) => q.status === "sent").length,
      accepted: quotes.filter((q) => q.status === "accepted").length,
      declined: quotes.filter((q) => q.status === "declined").length,
      expired: quotes.filter((q) => q.status === "expired").length,
      total_value: quotes.reduce((s, q) => s + Number(q.total), 0),
      accepted_value: quotes.filter((q) => q.status === "accepted").reduce((s, q) => s + Number(q.total), 0),
      win_rate: (() => {
        const decided = quotes.filter((q) => q.status === "accepted" || q.status === "declined").length;
        if (!decided) return 0;
        return Math.round((quotes.filter((q) => q.status === "accepted").length / decided) * 100);
      })(),
    };
    return { quotes, totals };
  });

export const getQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), organization_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [q, items] = await Promise.all([
      supabase.from("quotes").select("*").eq("id", data.id).eq("organization_id", data.organization_id).single(),
      supabase.from("quote_items").select("*").eq("quote_id", data.id).eq("organization_id", data.organization_id).order("position", { ascending: true }),
    ]);
    if (q.error) throw new Error(q.error.message);
    if (items.error) throw new Error(items.error.message);
    return { quote: q.data as Quote, items: (items.data ?? []) as QuoteItem[] };
  });

export const upsertQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      organization_id: z.string().uuid(),
      title: z.string().min(1).max(200),
      contact_id: z.string().uuid().nullable().optional(),
      company_id: z.string().uuid().nullable().optional(),
      deal_id: z.string().uuid().nullable().optional(),
      status: z.enum(["draft", "sent", "accepted", "declined", "expired"]).default("draft"),
      issue_date: z.string().min(10).max(10),
      valid_until: z.string().min(10).max(10).nullable().optional(),
      currency: z.string().min(3).max(3).default("BRL"),
      discount: z.number().default(0),
      tax: z.number().default(0),
      notes: z.string().max(4000).nullable().optional(),
      items: z.array(z.object({
        product_id: z.string().uuid().nullable().optional(),
        description: z.string().min(1).max(500),
        quantity: z.number().min(0),
        unit_price: z.number().min(0),
        discount_pct: z.number().min(0).max(100).default(0),
      })).default([]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { items, ...quoteFields } = data;
    const { subtotal, total } = recomputeTotals(items, quoteFields.discount, quoteFields.tax);

    let quoteId = data.id;
    if (quoteId) {
      const { error } = await supabase
        .from("quotes")
        .update({ ...quoteFields, subtotal, total })
        .eq("id", quoteId);
      if (error) throw new Error(error.message);
      await supabase.from("quote_items").delete().eq("quote_id", quoteId);
    } else {
      // próximo número
      const { data: last } = await supabase
        .from("quotes")
        .select("number")
        .eq("organization_id", data.organization_id)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const next = (last?.number ?? 0) + 1;
      const { data: inserted, error } = await supabase
        .from("quotes")
        .insert({ ...quoteFields, number: next, subtotal, total })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      quoteId = inserted.id;
    }

    if (items.length) {
      const rows = items.map((it, idx) => {
        const gross = it.quantity * it.unit_price;
        const line_total = Math.round(gross * (1 - it.discount_pct / 100) * 100) / 100;
        return {
          organization_id: data.organization_id,
          quote_id: quoteId!,
          product_id: it.product_id ?? null,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount_pct: it.discount_pct,
          line_total,
          position: idx,
        };
      });
      const { error } = await supabase.from("quote_items").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { id: quoteId! };
  });

export const setQuoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "sent", "accepted", "declined", "expired"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("quotes").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("quotes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
