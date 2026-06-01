import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  orgId: z.string().uuid(),
  sinceDays: z.number().int().min(7).max(365).default(90),
});

export const getAIBacktestMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.sinceDays * 86400_000).toISOString();

    // resolve tenant root
    const { data: org } = await supabase
      .from("organizations")
      .select("id, parent_org_id, org_type")
      .eq("id", data.orgId)
      .maybeSingle();
    const tenantId = org?.org_type === "tenant" ? org.id : data.orgId;

    const types = ["churn", "repurchase", "leadscore"] as const;
    const results: Record<string, unknown> = {};
    for (const t of types) {
      const { data: rows, error } = await supabase.rpc("get_ai_backtest_metrics", {
        _tenant_id: tenantId,
        _prediction_type: t,
        _since: since,
      });
      if (error) throw new Error(`${t}: ${error.message}`);
      results[t] = rows?.[0] ?? null;
    }
    return { tenantId, sinceDays: data.sinceDays, metrics: results };
  });

export const closeAIPredictionOutcomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: org } = await supabase
      .from("organizations")
      .select("id, org_type")
      .eq("id", data.orgId)
      .maybeSingle();
    const tenantId = org?.org_type === "tenant" ? org.id : data.orgId;
    const { data: rows, error } = await supabase.rpc("close_ai_prediction_outcomes", {
      _tenant_id: tenantId,
    });
    if (error) throw new Error(error.message);
    return rows?.[0] ?? { closed: 0, churn_closed: 0, repurchase_closed: 0 };
  });
