import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================================
// Influencer Intelligence: visits + conversions + métricas de ROI.
// ============================================================================

const orgInput = z.object({ organization_id: z.string().uuid() });

export const getInfluencerMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const [infRes, visitRes, convRes] = await Promise.all([
      supabase
        .from("influencers")
        .select("id,name,handle,platform,slug,coupon_code,commission_pct,is_active")
        .eq("organization_id", org),
      supabase
        .from("influencer_visits")
        .select("influencer_id,created_at")
        .eq("organization_id", org)
        .gte("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString()),
      supabase
        .from("influencer_conversions")
        .select("influencer_id,kind,value,commission,status,created_at")
        .eq("organization_id", org)
        .gte("created_at", new Date(Date.now() - 90 * 86_400_000).toISOString()),
    ]);

    const visitsByInf = new Map<string, number>();
    for (const v of visitRes.data ?? []) {
      visitsByInf.set(v.influencer_id, (visitsByInf.get(v.influencer_id) ?? 0) + 1);
    }
    const convByInf = new Map<
      string,
      { leads: number; deals: number; orders: number; revenue: number; commission: number; won: number }
    >();
    for (const c of convRes.data ?? []) {
      const cur = convByInf.get(c.influencer_id) ?? {
        leads: 0, deals: 0, orders: 0, revenue: 0, commission: 0, won: 0,
      };
      if (c.kind === "lead") cur.leads += 1;
      if (c.kind === "deal") cur.deals += 1;
      if (c.kind === "order") cur.orders += 1;
      if (c.status === "won" || c.status === "paid") {
        cur.revenue += Number(c.value ?? 0);
        cur.commission += Number(c.commission ?? 0);
        cur.won += 1;
      }
      convByInf.set(c.influencer_id, cur);
    }

    const rows = (infRes.data ?? []).map((inf) => {
      const v = visitsByInf.get(inf.id) ?? 0;
      const c = convByInf.get(inf.id) ?? { leads: 0, deals: 0, orders: 0, revenue: 0, commission: 0, won: 0 };
      const totalConv = c.leads + c.deals + c.orders;
      return {
        ...inf,
        visits_90d: v,
        leads_90d: c.leads,
        deals_90d: c.deals,
        orders_90d: c.orders,
        revenue_90d: c.revenue,
        commission_90d: c.commission,
        conversion_rate: v > 0 ? Math.round((totalConv / v) * 1000) / 10 : 0,
        roi: c.commission > 0 ? Math.round(((c.revenue - c.commission) / c.commission) * 100) : null,
      };
    });

    rows.sort((a, b) => b.revenue_90d - a.revenue_90d);

    const totals = rows.reduce(
      (acc, r) => {
        acc.visits += r.visits_90d;
        acc.revenue += r.revenue_90d;
        acc.commission += r.commission_90d;
        acc.leads += r.leads_90d;
        acc.deals += r.deals_90d;
        return acc;
      },
      { visits: 0, revenue: 0, commission: 0, leads: 0, deals: 0 }
    );

    return { influencers: rows, totals };
  });

export const recordConversion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      influencer_id: z.string().uuid(),
      kind: z.enum(["lead", "deal", "order"]),
      ref_id: z.string().uuid().optional(),
      value: z.number().min(0).default(0),
      status: z.enum(["open", "won", "lost", "paid"]).default("open"),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    // calcula comissão a partir do influencer
    const { data: inf } = await context.supabase
      .from("influencers")
      .select("commission_pct,organization_id")
      .eq("id", data.influencer_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (!inf) throw new Error("Influenciador não encontrado");
    const commission = Math.round(((Number(inf.commission_pct ?? 0) / 100) * data.value) * 100) / 100;

    const { error } = await context.supabase.from("influencer_conversions").insert({
      organization_id: data.organization_id,
      influencer_id: data.influencer_id,
      kind: data.kind,
      ref_id: data.ref_id ?? null,
      value: data.value,
      commission,
      status: data.status,
    });
    if (error) throw new Error(error.message);
    return { ok: true, commission };
  });
