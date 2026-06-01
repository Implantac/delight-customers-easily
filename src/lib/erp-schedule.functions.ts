import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Agendamento de syncs recorrentes do ConnectHub.
 * Em vez de exigir expressões cron completas, oferecemos presets simples
 * (a cada N minutos / horas / diariamente). O tick interno calcula
 * `next_sync_at` e enfileira jobs quando vence.
 */

const RESOURCES = [
  "customers",
  "sales_reps",
  "sales_history",
  "products",
  "metrics",
] as const;

const FREQS = ["off", "15min", "30min", "hourly", "every_6h", "daily"] as const;
export type ScheduleFreq = (typeof FREQS)[number];

export const FREQ_LABELS: Record<ScheduleFreq, string> = {
  off: "Desligado",
  "15min": "A cada 15 minutos",
  "30min": "A cada 30 minutos",
  hourly: "A cada hora",
  every_6h: "A cada 6 horas",
  daily: "Diariamente",
};

function freqToCron(f: ScheduleFreq): string | null {
  switch (f) {
    case "off":
      return null;
    case "15min":
      return "*/15 * * * *";
    case "30min":
      return "*/30 * * * *";
    case "hourly":
      return "0 * * * *";
    case "every_6h":
      return "0 */6 * * *";
    case "daily":
      return "0 3 * * *";
  }
}

function cronToFreq(cron: string | null): ScheduleFreq {
  if (!cron) return "off";
  if (cron === "*/15 * * * *") return "15min";
  if (cron === "*/30 * * * *") return "30min";
  if (cron === "0 * * * *") return "hourly";
  if (cron === "0 */6 * * *") return "every_6h";
  if (cron === "0 3 * * *") return "daily";
  return "hourly";
}

function nextRunFor(f: ScheduleFreq): Date | null {
  const now = new Date();
  switch (f) {
    case "off":
      return null;
    case "15min":
      return new Date(now.getTime() + 15 * 60_000);
    case "30min":
      return new Date(now.getTime() + 30 * 60_000);
    case "hourly":
      return new Date(now.getTime() + 60 * 60_000);
    case "every_6h":
      return new Date(now.getTime() + 6 * 60 * 60_000);
    case "daily": {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(3, 0, 0, 0);
      return d;
    }
  }
}

// ============================================================================
// READ: schedule atual de uma integração
// ============================================================================
export const getErpSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        integrationId: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("erp_integrations")
      .select("id, provider, sync_cron, next_sync_at, resources, sync_mode, is_active")
      .eq("organization_id", data.organizationId)
      .eq("id", data.integrationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Integração não encontrada");
    return {
      integration: row,
      frequency: cronToFreq(row.sync_cron ?? null) as ScheduleFreq,
    };
  });

// ============================================================================
// WRITE: atualizar schedule
// ============================================================================
export const updateErpSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        integrationId: z.string().uuid(),
        frequency: z.enum(FREQS),
        resources: z.array(z.enum(RESOURCES)).min(1),
        direction: z.enum(["pull", "push", "bidirectional"]).default("pull"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const cron = freqToCron(data.frequency);
    const next = nextRunFor(data.frequency);
    const { error } = await supabase
      .from("erp_integrations")
      .update({
        sync_cron: cron,
        next_sync_at: next ? next.toISOString() : null,
        resources: data.resources,
        sync_mode: data.direction,
      })
      .eq("organization_id", data.organizationId)
      .eq("id", data.integrationId);
    if (error) throw new Error(error.message);
    return { ok: true, nextRunAt: next?.toISOString() ?? null };
  });

// ============================================================================
// LIST: todas as integrações com agendamento configurado da org
// ============================================================================
export const listErpSchedules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ organizationId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("erp_integrations")
      .select(
        "id, provider, sync_cron, next_sync_at, last_sync_at, resources, sync_mode, is_active",
      )
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);
    return {
      rows: (rows ?? []).map((r) => ({
        ...r,
        frequency: cronToFreq(r.sync_cron ?? null) as ScheduleFreq,
      })),
    };
  });

// ============================================================================
// TICK: chamado pelo pg_cron — enfileira syncs de integrações vencidas.
// Usa admin client (bypass RLS) pois roda fora de contexto de usuário.
// ============================================================================
export async function runDueErpSyncs(): Promise<{
  scanned: number;
  enqueued: number;
  integrations: Array<{ id: string; provider: string; jobs: number }>;
}> {
  const admin = supabaseAdmin;
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from("erp_integrations")
    .select("id, organization_id, provider, resources, sync_mode, sync_cron")
    .eq("is_active", true)
    .not("sync_cron", "is", null)
    .lte("next_sync_at", nowIso)
    .limit(50);

  if (error) throw new Error(error.message);

  const out: Array<{ id: string; provider: string; jobs: number }> = [];
  let totalEnqueued = 0;

  for (const integ of due ?? []) {
    const resources: string[] =
      Array.isArray(integ.resources) && integ.resources.length > 0
        ? integ.resources
        : ["customers", "sales_history"];
    const direction: "pull" | "push" =
      integ.sync_mode === "push" ? "push" : "pull";

    const rows = resources.map((resource) => ({
      organization_id: integ.organization_id,
      integration_id: integ.id,
      resource,
      direction,
    }));

    const { error: insErr } = await admin.from("erp_sync_jobs").insert(rows);
    if (insErr) {
      console.error("[erp-sync-tick] enqueue failed", integ.id, insErr.message);
      continue;
    }

    // Recalcula next_sync_at a partir do cron preset
    const freq = (() => {
      switch (integ.sync_cron) {
        case "*/15 * * * *":
          return "15min";
        case "*/30 * * * *":
          return "30min";
        case "0 * * * *":
          return "hourly";
        case "0 */6 * * *":
          return "every_6h";
        case "0 3 * * *":
          return "daily";
        default:
          return "hourly";
      }
    })() as ScheduleFreq;
    const next = nextRunFor(freq);
    await admin
      .from("erp_integrations")
      .update({ next_sync_at: next?.toISOString() ?? null })
      .eq("id", integ.id);

    totalEnqueued += rows.length;
    out.push({ id: integ.id, provider: integ.provider, jobs: rows.length });
  }

  return { scanned: due?.length ?? 0, enqueued: totalEnqueued, integrations: out };
}
