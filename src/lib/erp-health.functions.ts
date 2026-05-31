/**
 * ERP Health Center + Resolução de Conflitos.
 * Server functions para listar/resolver conflitos detectados pelo Sync Engine
 * e exibir o status agregado de cada integração.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Health Center ----------

export const listErpHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) =>
    z.object({ organization_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: integrations } = await supabase
      .from("erp_integrations")
      .select("id,provider,connector_type,is_active,last_sync_at,last_error")
      .eq("organization_id", data.organization_id)
      .order("provider");

    const items = await Promise.all(
      (integrations ?? []).map(async (i) => {
        const { data: last } = await supabase
          .from("erp_health_checks")
          .select("status,checked_at,error_message,latency_ms")
          .eq("integration_id", i.id)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count: pendingJobs } = await supabase
          .from("erp_sync_jobs")
          .select("id", { count: "exact", head: true })
          .eq("integration_id", i.id)
          .eq("status", "pending");

        const { count: failedJobs } = await supabase
          .from("erp_sync_jobs")
          .select("id", { count: "exact", head: true })
          .eq("integration_id", i.id)
          .eq("status", "failed");

        const { count: conflicts } = await supabase
          .from("erp_sync_conflicts")
          .select("id", { count: "exact", head: true })
          .eq("integration_id", i.id)
          .is("resolved_at", null);

        return {
          integration_id: i.id,
          provider: i.provider,
          connector_type: i.connector_type,
          is_active: i.is_active,
          last_sync_at: i.last_sync_at,
          last_error: i.last_error,
          health_status: last?.status ?? (i.is_active ? "unknown" : "down"),
          health_checked_at: last?.checked_at ?? null,
          latency_ms: last?.latency_ms ?? null,
          pending_jobs: pendingJobs ?? 0,
          failed_jobs: failedJobs ?? 0,
          open_conflicts: conflicts ?? 0,
        };
      }),
    );

    return { items };
  });

// ---------- Conflicts ----------

export const listErpConflicts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; integration_id?: string; limit?: number }) =>
    z.object({
      organization_id: z.string().uuid(),
      integration_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("erp_sync_conflicts")
      .select("id,integration_id,resource,external_id,field,crm_value,erp_value,detected_at,resolution,resolved_at")
      .eq("organization_id", data.organization_id)
      .is("resolved_at", null)
      .order("detected_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.integration_id) q = q.eq("integration_id", data.integration_id);
    const { data: items, error } = await q;
    if (error) throw new Error(error.message);
    return { items: items ?? [] };
  });

export const resolveErpConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    conflict_id: string;
    resolution: "use_crm" | "use_erp" | "merge" | "ignore";
    notes?: string;
  }) => z.object({
    organization_id: z.string().uuid(),
    conflict_id: z.string().uuid(),
    resolution: z.enum(["use_crm", "use_erp", "merge", "ignore"]),
    notes: z.string().max(1000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: conflict, error: ferr } = await supabase
      .from("erp_sync_conflicts")
      .select("id,organization_id,integration_id,resource,external_id,field,crm_value,erp_value,resolved_at")
      .eq("id", data.conflict_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (ferr) throw new Error(ferr.message);
    if (!conflict) throw new Error("Conflito não encontrado.");
    if (conflict.resolved_at) throw new Error("Conflito já resolvido.");

    // Aplica a resolução nas tabelas-espelho quando possível.
    if (data.resolution === "use_crm" && conflict.resource === "customers" && conflict.field) {
      const patch: Record<string, unknown> = {};
      const crmVal = (conflict.crm_value as Record<string, unknown> | null)?.[conflict.field];
      if (crmVal !== undefined) patch[conflict.field] = crmVal;
      if (Object.keys(patch).length > 0) {
        await supabase.from("erp_customers").update(patch as never)
          .eq("organization_id", data.organization_id)
          .eq("integration_id", conflict.integration_id)
          .eq("external_id", conflict.external_id);
      }
    }
    // use_erp = mantém o valor que já foi upsertado pelo sync (default)
    // merge / ignore = somente registra a decisão

    const { error: uerr } = await supabase
      .from("erp_sync_conflicts")
      .update({
        resolution: data.resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        notes: data.notes ?? null,
      })
      .eq("id", data.conflict_id);
    if (uerr) throw new Error(uerr.message);

    return { ok: true };
  });
