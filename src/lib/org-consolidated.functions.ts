import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ConsolidatedRow = {
  org_id: string;
  org_name: string;
  org_type: "tenant" | "company" | "branch";
  orders_count: number;
  revenue: number;
  distinct_customers: number;
};

export type ConsolidatedResponse = {
  rootOrgId: string;
  days: number;
  rows: ConsolidatedRow[];
  totals: { orders: number; revenue: number; customers: number; companies: number; branches: number };
};

export const getOrgConsolidated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orgId: z.string().uuid(),
      days: z.number().int().min(7).max(365).default(90),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ConsolidatedResponse> => {
    const { supabase } = context;
    const { data: org } = await supabase
      .from("organizations")
      .select("id, org_type")
      .eq("id", data.orgId)
      .maybeSingle();
    const root = org?.org_type === "tenant" ? org.id : data.orgId;

    const { data: rows, error } = await supabase.rpc("get_org_consolidated_rollup", {
      _root_org: root,
      _days: data.days,
    });
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as ConsolidatedRow[];
    const totals = list.reduce(
      (acc, r) => {
        if (r.org_type === "tenant") return acc; // evita dupla contagem no agregado
        acc.orders += Number(r.orders_count ?? 0);
        acc.revenue += Number(r.revenue ?? 0);
        acc.customers += Number(r.distinct_customers ?? 0);
        if (r.org_type === "company") acc.companies += 1;
        if (r.org_type === "branch") acc.branches += 1;
        return acc;
      },
      { orders: 0, revenue: 0, customers: 0, companies: 0, branches: 0 },
    );

    return { rootOrgId: root, days: data.days, rows: list, totals };
  });
