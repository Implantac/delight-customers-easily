import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// =============================================================================
// #6 Dashboards comparativos multiempresa.
// Reaproveita RPC get_org_consolidated_rollup já existente, e adiciona:
//  - série temporal por empresa/filial
//  - ranking comparativo (revenue, ticket médio, clientes ativos)
// =============================================================================

export const getConsolidatedRollup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        root_org_id: z.string().uuid(),
        days: z.number().int().min(7).max(720).default(90),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("get_org_consolidated_rollup", {
      _root_org: data.root_org_id,
      _days: data.days,
    });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getMultiOrgComparison = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        root_org_id: z.string().uuid(),
        days: z.number().int().min(7).max(720).default(90),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isMember } = await supabase.rpc("is_org_or_descendant_member", {
      _root: data.root_org_id,
      _user: userId,
    });
    if (!isMember) throw new Error("Acesso negado à hierarquia");

    const { data: descendants, error: e1 } = await supabase.rpc("org_descendants", {
      _root: data.root_org_id,
    });
    if (e1) throw new Error(e1.message);
    const orgIds = (descendants ?? []).map((d: { organization_id: string }) => d.organization_id);
    if (!orgIds.length) {
      return { orgs: [], series: [], leaderboard: [], totals: null };
    }

    const [orgsRes, salesRes, dealsRes] = await Promise.all([
      supabase
        .from("organizations")
        .select("id, name, org_type, parent_org_id, slug, cnpj")
        .in("id", orgIds),
      supabase
        .from("erp_sales_history")
        .select("organization_id, total_value, order_date, erp_customer_id")
        .in("organization_id", orgIds)
        .gte("order_date", new Date(Date.now() - data.days * 86400000).toISOString()),
      supabase
        .from("deals")
        .select("organization_id, stage, value, closed_at")
        .in("organization_id", orgIds)
        .gte("created_at", new Date(Date.now() - data.days * 86400000).toISOString()),
    ]);

    const orgs = orgsRes.data ?? [];
    const sales = salesRes.data ?? [];
    const deals = dealsRes.data ?? [];

    // Agregados por organização
    const agg = new Map<
      string,
      {
        org_id: string;
        org_name: string;
        org_type: string;
        revenue: number;
        orders: number;
        unique_customers: Set<string>;
        won_value: number;
        won_count: number;
        pipeline_value: number;
        pipeline_count: number;
      }
    >();
    for (const o of orgs) {
      agg.set(o.id, {
        org_id: o.id,
        org_name: o.name,
        org_type: o.org_type,
        revenue: 0,
        orders: 0,
        unique_customers: new Set(),
        won_value: 0,
        won_count: 0,
        pipeline_value: 0,
        pipeline_count: 0,
      });
    }
    for (const s of sales) {
      const a = agg.get(s.organization_id);
      if (!a) continue;
      a.revenue += Number(s.total_value ?? 0);
      a.orders += 1;
      if (s.erp_customer_id) a.unique_customers.add(s.erp_customer_id);
    }
    for (const d of deals) {
      const a = agg.get(d.organization_id);
      if (!a) continue;
      const v = Number(d.value ?? 0);
      if (d.stage === "won") {
        a.won_value += v;
        a.won_count += 1;
      } else if (d.stage !== "lost") {
        a.pipeline_value += v;
        a.pipeline_count += 1;
      }
    }

    const leaderboard = Array.from(agg.values())
      .map((a) => ({
        org_id: a.org_id,
        org_name: a.org_name,
        org_type: a.org_type,
        revenue: Math.round(a.revenue * 100) / 100,
        orders: a.orders,
        active_customers: a.unique_customers.size,
        avg_ticket: a.orders > 0 ? Math.round((a.revenue / a.orders) * 100) / 100 : 0,
        won_value: Math.round(a.won_value * 100) / 100,
        won_count: a.won_count,
        pipeline_value: Math.round(a.pipeline_value * 100) / 100,
        pipeline_count: a.pipeline_count,
        conversion_pct:
          a.won_count + a.pipeline_count > 0
            ? Math.round((a.won_count / (a.won_count + a.pipeline_count)) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Série temporal (revenue por dia, por org)
    const byDay = new Map<string, Map<string, number>>(); // day -> orgId -> revenue
    for (const s of sales) {
      const day = (s.order_date ?? "").slice(0, 10);
      if (!day) continue;
      let m = byDay.get(day);
      if (!m) {
        m = new Map();
        byDay.set(day, m);
      }
      m.set(s.organization_id, (m.get(s.organization_id) ?? 0) + Number(s.total_value ?? 0));
    }
    const series = Array.from(byDay.entries())
      .map(([day, m]) => {
        const entry: Record<string, string | number> = { day };
        for (const [oid, v] of m) entry[oid] = Math.round(v * 100) / 100;
        return entry;
      })
      .sort((a, b) => String(a.day).localeCompare(String(b.day)));

    const totals = leaderboard.reduce(
      (acc, r) => {
        acc.revenue += r.revenue;
        acc.orders += r.orders;
        acc.won_value += r.won_value;
        acc.pipeline_value += r.pipeline_value;
        return acc;
      },
      { revenue: 0, orders: 0, won_value: 0, pipeline_value: 0 },
    );

    return { orgs, leaderboard, series, totals };
  });
