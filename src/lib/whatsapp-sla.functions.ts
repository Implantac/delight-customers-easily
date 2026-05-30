import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================================
// WhatsApp SLA: políticas por prioridade + cálculo de risco/violação.
// Uma conversa "em risco" é aquela cujo SLA de primeira resposta vence em
// menos de 5 minutos. "Violada" é aquela que já passou do prazo sem resposta
// ou sem resolução.
// ============================================================================

const orgInput = z.object({ organization_id: z.string().uuid() });

export const listSlaPolicies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("whatsapp_sla_policies")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("priority");
    return { policies: rows ?? [] };
  });

export const upsertSlaPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      priority: z.enum(["low", "normal", "high", "urgent"]),
      first_response_minutes: z.number().int().min(1).max(1440),
      resolution_minutes: z.number().int().min(5).max(10080),
      business_hours_only: z.boolean().default(false),
      is_active: z.boolean().default(true),
      name: z.string().min(1).max(80).default("Padrão"),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("whatsapp_sla_policies")
      .upsert(
        {
          organization_id: data.organization_id,
          priority: data.priority,
          first_response_minutes: data.first_response_minutes,
          resolution_minutes: data.resolution_minutes,
          business_hours_only: data.business_hours_only,
          is_active: data.is_active,
          name: data.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,priority" }
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSlaDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const [polRes, convRes] = await Promise.all([
      supabase
        .from("whatsapp_sla_policies")
        .select("priority,first_response_minutes,resolution_minutes,is_active")
        .eq("organization_id", org),
      supabase
        .from("whatsapp_conversations")
        .select(
          "id,contact_name,contact_phone,priority,status,assigned_to,first_message_at,last_customer_message_at,first_response_at,resolved_at"
        )
        .eq("organization_id", org)
        .neq("status", "resolved")
        .order("last_message_at", { ascending: false })
        .limit(500),
    ]);

    const policyByPrio = new Map<string, { first: number; resolve: number; active: boolean }>();
    for (const p of polRes.data ?? []) {
      policyByPrio.set(p.priority, {
        first: p.first_response_minutes,
        resolve: p.resolution_minutes,
        active: p.is_active,
      });
    }
    const defaults = { first: 15, resolve: 240, active: true };
    const now = Date.now();

    const enriched = (convRes.data ?? []).map((c) => {
      const pol = policyByPrio.get(c.priority) ?? defaults;
      const startedAt = new Date(c.last_customer_message_at ?? c.first_message_at).getTime();
      const firstDue = startedAt + pol.first * 60_000;
      const resolveDue = startedAt + pol.resolve * 60_000;
      const responded = !!c.first_response_at;
      const breachFirst = !responded && now > firstDue;
      const breachResolve = !c.resolved_at && now > resolveDue;
      const risk = !responded && firstDue - now < 5 * 60_000 && firstDue - now > 0;
      const due = !responded ? firstDue : resolveDue;
      return {
        ...c,
        sla_due_at: new Date(due).toISOString(),
        minutes_to_due: Math.round((due - now) / 60_000),
        breach_first_response: breachFirst,
        breach_resolution: breachResolve,
        at_risk: risk,
      };
    });

    const breached = enriched.filter((c) => c.breach_first_response || c.breach_resolution);
    const at_risk = enriched.filter((c) => c.at_risk && !c.breach_first_response);

    return {
      total_open: enriched.length,
      breached_count: breached.length,
      at_risk_count: at_risk.length,
      breached: breached.slice(0, 20),
      at_risk: at_risk.slice(0, 20),
      compliance_pct:
        enriched.length === 0 ? 100 : Math.round(((enriched.length - breached.length) / enriched.length) * 100),
    };
  });

// Marca conversas com SLA violado/em risco (cache em coluna) para uso em
// alertas e fila de recomendações.
export const syncSlaState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const dash = await getSlaDashboard({ data: { organization_id: data.organization_id } });
    const breachedIds = dash.breached.map((c) => c.id);
    if (breachedIds.length === 0) return { updated: 0 };
    const { error } = await context.supabase
      .from("whatsapp_conversations")
      .update({ sla_breached: true })
      .in("id", breachedIds);
    if (error) throw new Error(error.message);
    return { updated: breachedIds.length };
  });
