import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type BacktestMetric = {
  total: number;
  with_outcome: number;
  accuracy: number | null;
  precision_pos: number | null;
  recall_pos: number | null;
  avg_predicted: number | null;
  positive_rate: number | null;
} | null;

export type BacktestResponse = {
  tenantId: string;
  sinceDays: number;
  metrics: {
    churn: BacktestMetric;
    repurchase: BacktestMetric;
    leadscore: BacktestMetric;
  };
};

const Input = z.object({
  orgId: z.string().uuid(),
  sinceDays: z.number().int().min(7).max(365).default(90),
});

export const getAIBacktestMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<BacktestResponse> => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.sinceDays * 86400_000).toISOString();

    const { data: org } = await supabase
      .from("organizations")
      .select("id, org_type")
      .eq("id", data.orgId)
      .maybeSingle();
    const tenantId = org?.org_type === "tenant" ? org.id : data.orgId;

    const types = ["churn", "repurchase", "leadscore"] as const;
    const metrics: BacktestResponse["metrics"] = { churn: null, repurchase: null, leadscore: null };
    for (const t of types) {
      const { data: rows, error } = await supabase.rpc("get_ai_backtest_metrics", {
        _tenant_id: tenantId,
        _prediction_type: t,
        _since: since,
      });
      if (error) throw new Error(`${t}: ${error.message}`);
      metrics[t] = (rows?.[0] as BacktestMetric) ?? null;
    }
    return { tenantId, sinceDays: data.sinceDays, metrics };
  });

export type CloseOutcomesResponse = {
  closed: number;
  churn_closed: number;
  repurchase_closed: number;
};

export const closeAIPredictionOutcomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CloseOutcomesResponse> => {
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
    const r = rows?.[0];
    return {
      closed: Number(r?.closed ?? 0),
      churn_closed: Number(r?.churn_closed ?? 0),
      repurchase_closed: Number(r?.repurchase_closed ?? 0),
    };
  });
