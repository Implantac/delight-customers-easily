import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StockKind = "in" | "out" | "adjust";

export type StockMovement = {
  id: string;
  organization_id: string;
  product_id: string | null;
  product_name: string;
  kind: StockKind;
  quantity: number;
  unit_cost: number;
  reason: string | null;
  reference: string | null;
  occurred_at: string;
  created_at: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const listStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; kind?: StockKind | "all"; product?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("stock_movements")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (data.kind && data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.product) q = q.ilike("product_name", `%${data.product}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as StockMovement[];

    // Saldo agregado por produto
    const byProduct = new Map<string, { product_name: string; qty: number; value: number }>();
    let totalIn = 0, totalOut = 0, valueIn = 0, valueOut = 0;
    for (const m of list) {
      const q = Number(m.quantity);
      const c = Number(m.unit_cost);
      const sign = m.kind === "in" ? 1 : m.kind === "out" ? -1 : 1; // adjust acumula
      const cur = byProduct.get(m.product_name) ?? { product_name: m.product_name, qty: 0, value: 0 };
      cur.qty += sign * q;
      cur.value += sign * q * c;
      byProduct.set(m.product_name, cur);
      if (m.kind === "in") { totalIn += q; valueIn += q * c; }
      if (m.kind === "out") { totalOut += q; valueOut += q * c; }
    }
    const balances = Array.from(byProduct.values())
      .map((b) => ({ ...b, qty: round2(b.qty), value: round2(b.value) }))
      .sort((a, b) => b.qty - a.qty);

    return {
      movements: list,
      balances,
      totals: {
        count: list.length,
        in_qty: round2(totalIn),
        out_qty: round2(totalOut),
        net_qty: round2(totalIn - totalOut),
        in_value: round2(valueIn),
        out_value: round2(valueOut),
      },
    };
  });

export const createStockMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    product_id?: string | null;
    product_name: string;
    kind: StockKind;
    quantity: number;
    unit_cost?: number;
    reason?: string | null;
    reference?: string | null;
    occurred_at?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.product_name.trim()) throw new Error("Informe o produto");
    if (!data.quantity || data.quantity <= 0) throw new Error("Quantidade inválida");
    const { error } = await supabase.from("stock_movements").insert({
      organization_id: data.organization_id,
      product_id: data.product_id ?? null,
      product_name: data.product_name.trim(),
      kind: data.kind,
      quantity: data.quantity,
      unit_cost: data.unit_cost ?? 0,
      reason: data.reason ?? null,
      reference: data.reference ?? null,
      occurred_at: data.occurred_at ?? new Date().toISOString(),
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStockMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("stock_movements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
