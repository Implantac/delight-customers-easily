import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Drill-down por filial/empresa: pipeline, top reps, top clientes e
 * últimas atividades comerciais. Usado em /multi-empresa/[orgId].
 */
export const getOrgDrilldown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        days: z.number().int().min(7).max(720).default(90),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isMember } = await supabase.rpc("is_org_member", {
      _org: data.organization_id,
      _user: userId,
    });
    if (!isMember) throw new Error("Acesso negado");

    const sinceIso = new Date(Date.now() - data.days * 86400000).toISOString();

    const [orgRes, dealsRes, salesRes, repsRes, activitiesRes] = await Promise.all([
      supabase.from("organizations").select("id, name, org_type, slug, cnpj").eq("id", data.organization_id).maybeSingle(),
      supabase
        .from("deals")
        .select("id, title, stage, value, user_id, company_id, created_at, closed_at")
        .eq("organization_id", data.organization_id)
        .gte("created_at", sinceIso),
      supabase
        .from("erp_sales_history")
        .select("erp_customer_id, total_value, order_date")
        .eq("organization_id", data.organization_id)
        .gte("order_date", sinceIso),
      supabase
        .from("memberships")
        .select("user_id, role, profiles!inner(full_name)")
        .eq("organization_id", data.organization_id),
      supabase
        .from("activities")
        .select("id, type, title, created_at, user_id")
        .eq("organization_id", data.organization_id)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const deals = dealsRes.data ?? [];
    const sales = salesRes.data ?? [];
    const reps = repsRes.data ?? [];
    const activities = activitiesRes.data ?? [];

    // Pipeline por estágio
    const pipelineByStage = new Map<string, { count: number; value: number }>();
    for (const d of deals) {
      const k = d.stage ?? "unknown";
      const cur = pipelineByStage.get(k) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += Number(d.value ?? 0);
      pipelineByStage.set(k, cur);
    }
    const pipeline = Array.from(pipelineByStage.entries()).map(([stage, v]) => ({
      stage,
      count: v.count,
      value: Math.round(v.value * 100) / 100,
    }));

    // Top reps (won value)
    const repAgg = new Map<string, { name: string; won: number; won_count: number; pipeline: number }>();
    for (const r of reps) {
      const name =
        (r as { profiles?: { full_name?: string | null } | null }).profiles?.full_name ??
        "Usuário";
      repAgg.set(r.user_id, { name, won: 0, won_count: 0, pipeline: 0 });
    }
    for (const d of deals) {
      if (!d.user_id) continue;
      const r = repAgg.get(d.user_id);
      if (!r) continue;
      const v = Number(d.value ?? 0);
      if (d.stage === "won") {
        r.won += v;
        r.won_count += 1;
      } else if (d.stage !== "lost") {
        r.pipeline += v;
      }
    }
    const topReps = Array.from(repAgg.entries())
      .map(([user_id, v]) => ({ user_id, ...v, won: Math.round(v.won * 100) / 100, pipeline: Math.round(v.pipeline * 100) / 100 }))
      .sort((a, b) => b.won - a.won)
      .slice(0, 10);

    // Top clientes ERP por receita
    const custAgg = new Map<string, { revenue: number; orders: number }>();
    for (const s of sales) {
      if (!s.erp_customer_id) continue;
      const cur = custAgg.get(s.erp_customer_id) ?? { revenue: 0, orders: 0 };
      cur.revenue += Number(s.total_value ?? 0);
      cur.orders += 1;
      custAgg.set(s.erp_customer_id, cur);
    }
    const topCustomerIds = Array.from(custAgg.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10);

    const { data: custInfo } = await supabase
      .from("erp_customers")
      .select("id, trade_name, legal_name, city, state")
      .in(
        "id",
        topCustomerIds.length
          ? topCustomerIds.map(([id]) => id)
          : ["00000000-0000-0000-0000-000000000000"],
      );
    const infoById = new Map((custInfo ?? []).map((c) => [c.id, c] as const));
    const topCustomers = topCustomerIds.map(([id, v]) => ({
      erp_customer_id: id,
      name:
        infoById.get(id)?.trade_name ?? infoById.get(id)?.legal_name ?? id.slice(0, 8),
      city: infoById.get(id)?.city ?? null,
      state: infoById.get(id)?.state ?? null,
      revenue: Math.round(v.revenue * 100) / 100,
      orders: v.orders,
    }));

    const totalRevenue = sales.reduce((s, x) => s + Number(x.total_value ?? 0), 0);
    const totalWon = deals.filter((d) => d.stage === "won").reduce((s, d) => s + Number(d.value ?? 0), 0);
    const totalPipeline = deals
      .filter((d) => d.stage !== "won" && d.stage !== "lost")
      .reduce((s, d) => s + Number(d.value ?? 0), 0);

    return {
      org: orgRes.data,
      totals: {
        revenue: Math.round(totalRevenue * 100) / 100,
        won_value: Math.round(totalWon * 100) / 100,
        pipeline_value: Math.round(totalPipeline * 100) / 100,
        deals_count: deals.length,
        orders_count: sales.length,
      },
      pipeline,
      topReps,
      topCustomers,
      recentActivities: activities,
    };
  });
