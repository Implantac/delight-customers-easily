import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Top N clientes com maior risco de churn.
 * Faz join via customer_360_snapshot para resolver company_id + display_name + phone.
 */
export const listChurnRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        limit: z.number().int().min(1).max(20).default(5),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: preds, error } = await supabase
      .from("ai_churn_predictions")
      .select("erp_customer_id, churn_probability, risk_level, drivers")
      .eq("organization_id", data.organization_id)
      .in("risk_level", ["high", "critical", "medium"])
      .order("churn_probability", { ascending: false })
      .limit(data.limit * 3);
    if (error) throw new Error(error.message);

    const ids = (preds ?? []).map((p) => p.erp_customer_id).filter(Boolean) as string[];
    if (!ids.length) return { items: [] as Array<any> };

    const { data: snaps } = await supabase
      .from("customer_360_snapshot")
      .select("erp_customer_id, company_id, display_name, primary_phone, monetary, last_purchase_at")
      .eq("organization_id", data.organization_id)
      .in("erp_customer_id", ids);

    const byId = new Map((snaps ?? []).map((s) => [s.erp_customer_id, s]));
    const items = (preds ?? [])
      .map((p) => {
        const snap = byId.get(p.erp_customer_id);
        if (!snap) return null;
        return {
          erp_customer_id: p.erp_customer_id,
          company_id: snap.company_id,
          display_name: snap.display_name,
          primary_phone: snap.primary_phone,
          monetary: snap.monetary,
          last_purchase_at: snap.last_purchase_at,
          churn_probability: Number(p.churn_probability ?? 0),
          risk_level: p.risk_level,
          top_driver: Array.isArray(p.drivers) && p.drivers.length ? String(p.drivers[0]) : null,
        };
      })
      .filter(Boolean)
      .slice(0, data.limit);

    return { items };
  });
