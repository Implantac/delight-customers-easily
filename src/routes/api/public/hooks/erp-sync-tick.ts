import { createFileRoute } from '@tanstack/react-router';
import { createClient } from '@supabase/supabase-js';
import { requireCronApiKey } from '@/lib/cron-auth.server';
import { executeJob } from '@/lib/erp-sync-engine.server';

/**
 * Cron tick do Connect Hub. Cron sugerido: a cada 5 minutos.
 * - Recupera jobs presos (running > 30 min) com retry/backoff
 * - Promove jobs `pending` para `running` e executa via Sync Engine
 * - Cada driver é resolvido via `resolveDriverKey` (Bling, Postgres direto, etc.)
 * - Atualiza erp_integrations.last_sync_at / last_error
 * - Gera health checks por integração
 *
 * Regra: nenhuma lógica de ERP aqui (estoque, fiscal, compras). Só orquestração comercial.
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

        // 2) Promove próximos pending para running E EXECUTA via Sync Engine
        const { data: pending } = await supabase
          .from('erp_sync_jobs')
          .select('id, organization_id, integration_id, resource, cursor, attempts, max_attempts')
          .eq('status', 'pending')
          .lte('scheduled_at', nowIso)
          .order('scheduled_at', { ascending: true })
          .limit(MAX_RUN_PER_TICK);

        let executed = 0; let processedTotal = 0; let conflictsTotal = 0;
        for (const job of pending ?? []) {
          await supabase.from('erp_sync_jobs')
            .update({ status: 'running', started_at: new Date().toISOString() })
            .eq('id', job.id);

          const result = await executeJob(supabase, job);
          executed++;
          processedTotal += result.processed;
          conflictsTotal += result.failed;

          const attempts = (job.attempts ?? 0) + 1;
          if (result.ok) {
            await supabase.from('erp_sync_jobs').update({
              status: 'succeeded',
              finished_at: new Date().toISOString(),
              records_processed: result.processed,
              records_failed: result.failed,
              attempts,
            }).eq('id', job.id);

            await supabase.from('erp_integrations').update({
              last_sync_at: new Date().toISOString(),
              last_error: null,
            }).eq('id', job.integration_id);
          } else {
            const giveUp = attempts >= (job.max_attempts ?? 3);
            const patch: Record<string, unknown> = {
              status: giveUp ? 'failed' : 'pending',
              error_message: result.error ?? 'Erro desconhecido',
              attempts,
              started_at: null,
              finished_at: giveUp ? new Date().toISOString() : null,
            };
            if (!giveUp) patch.scheduled_at = new Date(Date.now() + attempts * 60_000).toISOString();
            await supabase.from('erp_sync_jobs').update(patch).eq('id', job.id);

            if (giveUp) {
              await supabase.from('erp_integrations').update({
                last_error: result.error ?? 'Falha após retries',
              }).eq('id', job.integration_id);
            }
          }
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
