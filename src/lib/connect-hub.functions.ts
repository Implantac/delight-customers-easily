import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Fase 2 — Connect Hub server functions.
 * Operações de orquestração de conectores ERP: enfileirar sync, listar jobs,
 * resolver conflitos, ver saúde. Não executa o sync (isso fica no cron tick).
 */

const RESOURCES = ['customers', 'sales_reps', 'sales_history', 'products', 'metrics'] as const;

// ---------- ENQUEUE SYNC ----------
export const enqueueErpSync = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        integrationId: z.string().uuid(),
        resources: z.array(z.enum(RESOURCES)).min(1),
        direction: z.enum(['pull', 'push']).default('pull'),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Confirma que a integração pertence à org (RLS já filtra, mas defense-in-depth)
    const { data: integration, error: intErr } = await supabase
      .from('erp_integrations')
      .select('id, is_active')
      .eq('organization_id', data.organizationId)
      .eq('id', data.integrationId)
      .maybeSingle();
    if (intErr) throw new Error(intErr.message);
    if (!integration) throw new Error('Integração não encontrada');
    if (!integration.is_active) throw new Error('Integração inativa');

    const rows = data.resources.map((resource) => ({
      organization_id: data.organizationId,
      integration_id: data.integrationId,
      resource,
      direction: data.direction,
      triggered_by: userId,
    }));

    const { data: jobs, error } = await supabase.from('erp_sync_jobs').insert(rows).select('id, resource');
    if (error) throw new Error(error.message);
    return { jobs: jobs ?? [] };
  });

// ---------- LIST JOBS ----------
export const listErpSyncJobs = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        integrationId: z.string().uuid().optional(),
        status: z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled']).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from('erp_sync_jobs')
      .select(
        'id, resource, direction, status, scheduled_at, started_at, finished_at, attempts, records_processed, records_failed, error_message, integration_id',
      )
      .eq('organization_id', data.organizationId)
      .order('created_at', { ascending: false })
      .limit(data.limit);
    if (data.integrationId) q = q.eq('integration_id', data.integrationId);
    if (data.status) q = q.eq('status', data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// ---------- LIST CONFLICTS ----------
export const listErpSyncConflicts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        onlyUnresolved: z.boolean().default(true),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from('erp_sync_conflicts')
      .select('*')
      .eq('organization_id', data.organizationId)
      .order('detected_at', { ascending: false })
      .limit(data.limit);
    if (data.onlyUnresolved) q = q.is('resolved_at', null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// ---------- RESOLVE CONFLICT ----------
export const resolveErpConflict = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        conflictId: z.string().uuid(),
        resolution: z.enum(['use_crm', 'use_erp', 'merge', 'ignore']),
        notes: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from('erp_sync_conflicts')
      .update({
        resolution: data.resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        notes: data.notes ?? null,
      })
      .eq('organization_id', data.organizationId)
      .eq('id', data.conflictId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- HEALTH OVERVIEW ----------
export const getErpHealthOverview = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [integrationsRes, healthRes, openJobsRes, openConflictsRes] = await Promise.all([
      supabase
        .from('erp_integrations')
        .select('id, provider, connector_type, sync_mode, is_active, last_sync_at, last_error')
        .eq('organization_id', data.organizationId),
      supabase
        .from('erp_health_checks')
        .select('integration_id, status, latency_ms, error_message, checked_at')
        .eq('organization_id', data.organizationId)
        .order('checked_at', { ascending: false })
        .limit(100),
      supabase
        .from('erp_sync_jobs')
        .select('id, integration_id, status', { count: 'exact', head: false })
        .eq('organization_id', data.organizationId)
        .in('status', ['pending', 'running']),
      supabase
        .from('erp_sync_conflicts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', data.organizationId)
        .is('resolved_at', null),
    ]);

    if (integrationsRes.error) throw new Error(integrationsRes.error.message);
    if (healthRes.error) throw new Error(healthRes.error.message);
    if (openJobsRes.error) throw new Error(openJobsRes.error.message);
    if (openConflictsRes.error) throw new Error(openConflictsRes.error.message);

    // Última checagem por integração
    const latestByIntegration = new Map<string, (typeof healthRes.data)[number]>();
    for (const h of healthRes.data ?? []) {
      if (!latestByIntegration.has(h.integration_id)) latestByIntegration.set(h.integration_id, h);
    }

    const integrations = (integrationsRes.data ?? []).map((i) => ({
      ...i,
      latestHealth: latestByIntegration.get(i.id) ?? null,
      openJobs: (openJobsRes.data ?? []).filter((j) => j.integration_id === i.id).length,
    }));

    return {
      integrations,
      totalOpenJobs: openJobsRes.data?.length ?? 0,
      totalOpenConflicts: openConflictsRes.count ?? 0,
    };
  });
