import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });

export type ProductRow = {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  unit_price: number;
  unit_cost: number;
  stock_qty: number;
  active: boolean;
};

export type ProductIntel = {
  product_id: string;
  sku: string | null;
  name: string;
  category: string | null;
  stock_qty: number;
  revenue: number;
  margin: number;
  qty_sold: number;
  orders_count: number;
  last_sold_at: string | null;
  abc: "A" | "B" | "C";
  xyz: "X" | "Y" | "Z";
  cv: number;
  suggestion: string;
};

export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("products")
      .select("id, sku, name, category, unit_price, unit_cost, stock_qty, active")
      .eq("organization_id", data.organization_id)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ProductRow[];
  });

const upsertInput = z.object({
  organization_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  sku: z.string().max(64).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  unit_price: z.number().min(0).max(1e12),
  unit_cost: z.number().min(0).max(1e12),
  stock_qty: z.number().min(0).max(1e12),
  active: z.boolean().optional(),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      organization_id: data.organization_id,
      name: data.name,
      sku: data.sku ?? null,
      category: data.category ?? null,
      unit_price: data.unit_price,
      unit_cost: data.unit_cost,
      stock_qty: data.stock_qty,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    payload.created_by = userId;
    const { data: row, error } = await supabase.from("products").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id as string };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ABC/XYZ analysis over last 180 days
export const getProductIntel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const since = new Date();
    since.setDate(since.getDate() - 180);

    const [productsRes, itemsRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, sku, name, category, unit_price, unit_cost, stock_qty, active")
        .eq("organization_id", org),
      supabase
        .from("order_items")
        .select("product_id, quantity, unit_price, unit_cost, occurred_at")
        .eq("organization_id", org)
        .gte("occurred_at", since.toISOString()),
    ]);
    if (productsRes.error) throw new Error(productsRes.error.message);
    if (itemsRes.error) throw new Error(itemsRes.error.message);

    const products = (productsRes.data ?? []) as ProductRow[];
    const items = (itemsRes.data ?? []) as Array<{
      product_id: string | null; quantity: number; unit_price: number; unit_cost: number; occurred_at: string;
    }>;

    // aggregate per product
    type Agg = {
      revenue: number; margin: number; qty: number; orders: number; last: string | null;
      monthly: Record<string, number>;
    };
    const agg = new Map<string, Agg>();
    for (const it of items) {
      if (!it.product_id) continue;
      const a = agg.get(it.product_id) ?? { revenue: 0, margin: 0, qty: 0, orders: 0, last: null, monthly: {} };
      const rev = Number(it.quantity) * Number(it.unit_price);
      const mar = Number(it.quantity) * (Number(it.unit_price) - Number(it.unit_cost));
      a.revenue += rev;
      a.margin += mar;
      a.qty += Number(it.quantity);
      a.orders += 1;
      if (!a.last || it.occurred_at > a.last) a.last = it.occurred_at;
      const mk = it.occurred_at.slice(0, 7);
      a.monthly[mk] = (a.monthly[mk] ?? 0) + rev;
      agg.set(it.product_id, a);
    }

    // ABC by revenue (sorted desc, cumulative %)
    const withRev = products
      .map((p) => ({ p, a: agg.get(p.id) ?? { revenue: 0, margin: 0, qty: 0, orders: 0, last: null, monthly: {} as Record<string, number> } }))
      .sort((x, y) => y.a.revenue - x.a.revenue);
    const totalRev = withRev.reduce((s, r) => s + r.a.revenue, 0);
    let cum = 0;
    const abcMap = new Map<string, "A" | "B" | "C">();
    for (const r of withRev) {
      if (totalRev === 0) { abcMap.set(r.p.id, "C"); continue; }
      cum += r.a.revenue;
      const pct = cum / totalRev;
      abcMap.set(r.p.id, pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C");
    }

    // XYZ by coefficient of variation across last 6 months
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const rows: ProductIntel[] = withRev.map(({ p, a }) => {
      const series = months.map((m) => a.monthly[m] ?? 0);
      const mean = series.reduce((s, v) => s + v, 0) / series.length;
      const variance = mean === 0 ? 0 : series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length;
      const std = Math.sqrt(variance);
      const cv = mean === 0 ? 999 : std / mean;
      const xyz: "X" | "Y" | "Z" = a.orders === 0 ? "Z" : cv <= 0.5 ? "X" : cv <= 1 ? "Y" : "Z";
      const abc = abcMap.get(p.id) ?? "C";

      let suggestion = "";
      if (abc === "A" && xyz === "X") suggestion = "Carro-chefe estável. Garanta estoque e foque negociação.";
      else if (abc === "A" && xyz === "Z") suggestion = "Alta receita, demanda volátil. Crie campanha para suavizar giro.";
      else if (abc === "C" && a.orders === 0) suggestion = "Sem vendas em 180d. Avalie descontinuar ou liquidar estoque.";
      else if (abc === "B") suggestion = "Potencial de upgrade para A. Faça cross-sell em pedidos A.";
      else if (xyz === "X") suggestion = "Demanda estável. Boa para combos e recorrência.";
      else suggestion = "Monitore. Acione clientes com histórico de recompra.";

      return {
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        stock_qty: Number(p.stock_qty),
        revenue: a.revenue,
        margin: a.margin,
        qty_sold: a.qty,
        orders_count: a.orders,
        last_sold_at: a.last,
        abc, xyz, cv: Math.round(cv * 100) / 100,
        suggestion,
      };
    });

    const summary = {
      total_revenue: totalRev,
      total_margin: rows.reduce((s, r) => s + r.margin, 0),
      count_A: rows.filter((r) => r.abc === "A").length,
      count_B: rows.filter((r) => r.abc === "B").length,
      count_C: rows.filter((r) => r.abc === "C").length,
      dead_stock: rows.filter((r) => r.orders_count === 0 && r.stock_qty > 0).length,
    };

    return { rows, summary };
  });
