import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { requireCronApiKey } from '@/lib/cron-auth.server';

/**
 * Cron tick do Connect Hub. Cron sugerido: a cada 5 minutos.
 * - Promove jobs `pending` cujo scheduled_at já passou para `running` (até N por tick).
 * - Para esta iteração o executor real por tipo de conector ainda não roda aqui;
 *   apenas reconcilia jobs presos (running há > 30 min) e gera health checks
 *   básicos por presença/ausência de erros recentes.
 *
 * IMPORTANTE: não criar lógica de ERP aqui (estoque, fiscal, compras). Apenas orquestração.
 */

const MAX_RUN_PER_TICK = 25;
const STUCK_THRESHOLD_MIN = 30;

export const Route = createFileRoute('/api/public/hooks/erp-sync-tick')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authErr = requireCronApiKey(request);
        if (authErr) return authErr;

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } },
        );

        const nowIso = new Date().toISOString();
        const stuckCutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60_000).toISOString();

        // 1) Recupera jobs travados em running
        const { data: stuck } = await supabase
          .from('erp_sync_jobs')
          .select('id, attempts, max_attempts')
          .eq('status', 'running')
          .lt('started_at', stuckCutoff);

        for (const j of stuck ?? []) {
          const nextAttempts = (j.attempts ?? 0) + 1;
          const failed = nextAttempts >= (j.max_attempts ?? 3);
          await supabase
            .from('erp_sync_jobs')
            .update({
              status: failed ? 'failed' : 'pending',
              attempts: nextAttempts,
              error_message: failed ? 'Timeout — job preso em running' : 'Reagendado após timeout',
              finished_at: failed ? nowIso : null,
              started_at: null,
            })
            .eq('id', j.id);
        }

        // 2) Promove próximos pending para running
        const { data: pending } = await supabase
          .from('erp_sync_jobs')
          .select('id, organization_id, integration_id, resource')
          .eq('status', 'pending')
          .lte('scheduled_at', nowIso)
          .order('scheduled_at', { ascending: true })
          .limit(MAX_RUN_PER_TICK);

        const promotedIds = (pending ?? []).map((p) => p.id);
        if (promotedIds.length > 0) {
          await supabase
            .from('erp_sync_jobs')
            .update({ status: 'running', started_at: nowIso })
            .in('id', promotedIds);

          // Marca como succeeded imediatamente (executor real virá depois).
          // Por ora apenas registra que o tick aceitou o job — evita acúmulo
          // enquanto a Fase 2.1 (executores por connector_type) não está pronta.
          await supabase
            .from('erp_sync_jobs')
            .update({
              status: 'succeeded',
              finished_at: new Date().toISOString(),
              records_processed: 0,
              error_message: 'Executor por tipo de conector não implementado nesta fase',
            })
            .in('id', promotedIds);
        }

        // 3) Health checks: integrações ativas sem sync nas últimas 24h => degraded
        const { data: integrations } = await supabase
          .from('erp_integrations')
          .select('id, organization_id, is_active, last_sync_at, last_error');

        const dayAgo = Date.now() - 24 * 60 * 60_000;
        const healthRows = (integrations ?? [])
          .filter((i) => i.is_active)
          .map((i) => {
            const stale = !i.last_sync_at || new Date(i.last_sync_at).getTime() < dayAgo;
            const errored = !!i.last_error;
            const status = errored ? 'down' : stale ? 'degraded' : 'healthy';
            return {
              organization_id: i.organization_id,
              integration_id: i.id,
              status,
              error_message: i.last_error ?? null,
              details: { stale, errored },
            };
          });
        if (healthRows.length > 0) {
          await supabase.from('erp_health_checks').insert(healthRows);
        }

        return new Response(
          JSON.stringify({
            stuckRecovered: stuck?.length ?? 0,
            promoted: promotedIds.length,
            healthLogged: healthRows.length,
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      },
    },
  },
});
