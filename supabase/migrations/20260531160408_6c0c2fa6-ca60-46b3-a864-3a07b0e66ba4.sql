
-- Fase 2: Connect Hub Universal — camada operacional

-- Estende erp_integrations com metadados de conector
ALTER TABLE public.erp_integrations
  ADD COLUMN IF NOT EXISTS connector_type text NOT NULL DEFAULT 'rest'
    CHECK (connector_type IN ('rest','postgres','mysql','sqlserver','firebird','oracle','file')),
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'pull'
    CHECK (sync_mode IN ('pull','push','bidirectional')),
  ADD COLUMN IF NOT EXISTS sync_cron text,
  ADD COLUMN IF NOT EXISTS resources text[] NOT NULL DEFAULT ARRAY['customers','sales_reps','sales_history']::text[];

-- =========================================================
-- erp_sync_jobs — fila de sincronização
-- =========================================================
CREATE TABLE public.erp_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.erp_integrations(id) ON DELETE CASCADE,
  resource text NOT NULL,              -- customers | sales_reps | sales_history | products | metrics
  direction text NOT NULL DEFAULT 'pull' CHECK (direction IN ('pull','push')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed','cancelled')),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  records_processed int NOT NULL DEFAULT 0,
  records_failed int NOT NULL DEFAULT 0,
  cursor jsonb,                        -- para pagination/incremental
  error_message text,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_erp_sync_jobs_org_status_sched ON public.erp_sync_jobs(organization_id, status, scheduled_at);
CREATE INDEX idx_erp_sync_jobs_integration_created ON public.erp_sync_jobs(integration_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_sync_jobs TO authenticated;
GRANT ALL ON public.erp_sync_jobs TO service_role;
ALTER TABLE public.erp_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_sync_jobs org members read" ON public.erp_sync_jobs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "erp_sync_jobs org admins write" ON public.erp_sync_jobs
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- =========================================================
-- erp_sync_conflicts — divergências CRM ↔ ERP
-- =========================================================
CREATE TABLE public.erp_sync_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.erp_integrations(id) ON DELETE CASCADE,
  resource text NOT NULL,
  external_id text NOT NULL,
  field text,
  crm_value jsonb,
  erp_value jsonb,
  resolution text CHECK (resolution IN ('use_crm','use_erp','merge','ignore')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX idx_erp_sync_conflicts_org_unresolved ON public.erp_sync_conflicts(organization_id, resolved_at)
  WHERE resolved_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_sync_conflicts TO authenticated;
GRANT ALL ON public.erp_sync_conflicts TO service_role;
ALTER TABLE public.erp_sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_sync_conflicts org members read" ON public.erp_sync_conflicts
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "erp_sync_conflicts org admins write" ON public.erp_sync_conflicts
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- =========================================================
-- erp_health_checks — heartbeat de conector
-- =========================================================
CREATE TABLE public.erp_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.erp_integrations(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('healthy','degraded','down')),
  latency_ms int,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_erp_health_org_integration_time ON public.erp_health_checks(organization_id, integration_id, checked_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_health_checks TO authenticated;
GRANT ALL ON public.erp_health_checks TO service_role;
ALTER TABLE public.erp_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_health_checks org members read" ON public.erp_health_checks
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "erp_health_checks org admins write" ON public.erp_health_checks
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
