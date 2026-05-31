import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCronApiKey } from "@/lib/cron-auth.server";

// Cron a cada 15min: detecta conversas de WhatsApp com SLA violado/em risco
// em TODAS as orgs e marca a flag `sla_breached`, alimentando alertas e a
// fila de recomendações sem depender do usuário abrir o painel.

async function syncOrg(orgId: string): Promise<{ updated: number; breached: number }> {
  const now = Date.now();
  const [pols, convs] = await Promise.all([
    supabaseAdmin
      .from("whatsapp_sla_policies")
      .select("priority,first_response_minutes,resolution_minutes,is_active")
      .eq("organization_id", orgId),
    supabaseAdmin
      .from("whatsapp_conversations")
      .select("id,priority,status,first_message_at,last_customer_message_at,first_response_at,resolved_at,sla_breached")
      .eq("organization_id", orgId)
      .neq("status", "resolved")
      .limit(500),
  ]);

  const polByPrio = new Map<string, { first: number; resolve: number }>();
  for (const p of pols.data ?? []) {
    polByPrio.set(p.priority, { first: p.first_response_minutes, resolve: p.resolution_minutes });
  }
  const defaults = { first: 15, resolve: 240 };

  const toMark: string[] = [];
  const toClear: string[] = [];
  for (const c of convs.data ?? []) {
    const pol = polByPrio.get(c.priority) ?? defaults;
    const startedAt = new Date(c.last_customer_message_at ?? c.first_message_at).getTime();
    const firstDue = startedAt + pol.first * 60_000;
    const resolveDue = startedAt + pol.resolve * 60_000;
    const breachFirst = !c.first_response_at && now > firstDue;
    const breachResolve = !c.resolved_at && now > resolveDue;
    const breached = breachFirst || breachResolve;
    if (breached && !c.sla_breached) toMark.push(c.id);
    else if (!breached && c.sla_breached) toClear.push(c.id);
  }

  if (toMark.length) {
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({ sla_breached: true })
      .in("id", toMark);
  }
  if (toClear.length) {
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({ sla_breached: false })
      .in("id", toClear);
  }
  return { updated: toMark.length + toClear.length, breached: toMark.length };
}

export const Route = createFileRoute("/api/public/hooks/refresh-recommendations")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronApiKey(request);
        if (unauth) return unauth;
        const { data: orgs } = await supabaseAdmin.from("organizations").select("id");
        let totalUpdated = 0;
        let totalBreached = 0;
        for (const o of orgs ?? []) {
          try {
            const r = await syncOrg(o.id);
            totalUpdated += r.updated;
            totalBreached += r.breached;
          } catch (e) {
            console.error(`refresh-recommendations: org ${o.id} failed`, e);
          }
        }
        return Response.json({
          ok: true,
          organizations: orgs?.length ?? 0,
          updated: totalUpdated,
          breached: totalBreached,
          ts: new Date().toISOString(),
        });
      },
    },
  },
});
