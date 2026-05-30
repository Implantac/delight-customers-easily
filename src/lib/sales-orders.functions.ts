import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SalesOrderStatus =
  | "draft" | "confirmed" | "in_production" | "shipped" | "delivered" | "cancelled";

export type SalesOrder = {
  id: string;
  organization_id: string;
  number: number;
  title: string;
  status: SalesOrderStatus;
  quote_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  order_date: string;
  expected_delivery: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SalesOrderItem = {
  id: string;
  order_id: string;
  organization_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
  position: number;
};

type DraftItem = {
  description: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
};

function recompute(items: DraftItem[], discount: number, tax: number) {
  const subtotal = items.reduce(
    (s, i) => s + i.quantity * i.unit_price * (1 - (i.discount_pct || 0) / 100),
    0,
  );
  const total = Math.max(0, subtotal - (discount || 0) + (tax || 0));
  return { subtotal: round2(subtotal), total: round2(total) };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

export const listSalesOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; status?: SalesOrderStatus | "all" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("sales_orders")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("number", { ascending: false });
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: orders, error } = await q;
    if (error) throw new Error(error.message);

    const list = (orders ?? []) as SalesOrder[];
    const total_value = list.reduce((s, o) => s + Number(o.total), 0);
    const confirmed_value = list
      .filter((o) => ["confirmed", "in_production", "shipped", "delivered"].includes(o.status))
      .reduce((s, o) => s + Number(o.total), 0);
    const delivered = list.filter((o) => o.status === "delivered").length;
    return {
      orders: list,
      totals: {
        count: list.length,
        total_value: round2(total_value),
        confirmed_value: round2(confirmed_value),
        delivered,
      },
    };
  });

export const getSalesOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: order, error } = await supabase
      .from("sales_orders").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: items, error: e2 } = await supabase
      .from("sales_order_items").select("*").eq("order_id", data.id).order("position");
    if (e2) throw new Error(e2.message);
    return { order: order as SalesOrder, items: (items ?? []) as SalesOrderItem[] };
  });

export const upsertSalesOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    title: string;
    status: SalesOrderStatus;
    quote_id?: string | null;
    order_date: string;
    expected_delivery?: string | null;
    currency: string;
    discount: number;
    tax: number;
    notes?: string | null;
    items: DraftItem[];
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { subtotal, total } = recompute(data.items, data.discount, data.tax);

    let orderId = data.id;
    if (!orderId) {
      const { data: last } = await supabase
        .from("sales_orders")
        .select("number")
        .eq("organization_id", data.organization_id)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const next = ((last?.number as number | undefined) ?? 0) + 1;
      const { data: created, error } = await supabase
        .from("sales_orders")
        .insert({
          organization_id: data.organization_id,
          number: next,
          title: data.title,
          status: data.status,
          quote_id: data.quote_id ?? null,
          order_date: data.order_date,
          expected_delivery: data.expected_delivery ?? null,
          currency: data.currency,
          subtotal, discount: data.discount, tax: data.tax, total,
          notes: data.notes ?? null,
          created_by: userId,
        })
        .select("id").single();
      if (error) throw new Error(error.message);
      orderId = created.id;
    } else {
      const { error } = await supabase
        .from("sales_orders")
        .update({
          title: data.title,
          status: data.status,
          quote_id: data.quote_id ?? null,
          order_date: data.order_date,
          expected_delivery: data.expected_delivery ?? null,
          currency: data.currency,
          subtotal, discount: data.discount, tax: data.tax, total,
          notes: data.notes ?? null,
        })
        .eq("id", orderId);
      if (error) throw new Error(error.message);
      await supabase.from("sales_order_items").delete().eq("order_id", orderId);
    }

    if (data.items.length) {
      const rows = data.items.map((it, idx) => ({
        order_id: orderId!,
        organization_id: data.organization_id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount_pct: it.discount_pct,
        line_total: round2(it.quantity * it.unit_price * (1 - (it.discount_pct || 0) / 100)),
        position: idx,
      }));
      const { error } = await supabase.from("sales_order_items").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { id: orderId };
  });

export const setSalesOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: SalesOrderStatus }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sales_orders").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSalesOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sales_orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
