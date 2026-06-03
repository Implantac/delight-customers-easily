import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ActionSchema = z.object({
  type: z.enum(["create_task", "send_whatsapp", "create_notification", "suggest_visit"]),
  template: z.string().max(500).optional(),
});

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  trigger_type: z.enum([
    "no_purchase_days",
    "churn_risk_high",
    "high_potential_no_visit",
    "birthday",
    "new_lead_no_contact",
  ]),
  threshold: z.number().int().min(0).max(3650).nullable().optional(),
  actions: z.array(ActionSchema).min(1).max(5),
  enabled: z.boolean(),
});

export const listCommercialAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { organization_id: string }) =>
    z.object({ organization_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase as any)
      .from("commercial_automations")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { automations: (rows ?? []) as any[] };
  });

export const upsertCommercialAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      organization_id: data.organization_id,
      name: data.name,
      description: data.description ?? null,
      trigger_type: data.trigger_type,
      threshold: data.threshold ?? null,
      actions: data.actions,
      enabled: data.enabled,
    };
    if (data.id) {
      const { error } = await (supabase as any)
        .from("commercial_automations")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    payload.created_by = userId;
    const { data: row, error } = await (supabase as any)
      .from("commercial_automations")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteCommercialAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await (supabase as any)
      .from("commercial_automations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

import { runAutomationsForOrg } from "@/lib/automations-runner.server";

/**
 * Executa todas as automações comerciais da organização agora (manual).
 * Útil para testar regras sem esperar o cron diário.
 */
export const runCommercialAutomationsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { organization_id: string }) =>
    z.object({ organization_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const result = await runAutomationsForOrg(context.supabase as any, data.organization_id);
    return result;
  });
