
-- ===== integration_connections =====
CREATE TABLE public.integration_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('gmail','outlook','google_calendar','whatsapp')),
  account_label text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','error','disconnected')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, kind, account_label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT ALL ON public.integration_connections TO service_role;

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY ic_select ON public.integration_connections FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY ic_modify ON public.integration_connections FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER trg_ic_updated_at
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_ic_org_kind ON public.integration_connections(organization_id, kind);

-- ===== integration_sync_log =====
CREATE TABLE public.integration_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  kind text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  items_processed int NOT NULL DEFAULT 0,
  items_failed int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','error')),
  error text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_sync_log TO authenticated;
GRANT ALL ON public.integration_sync_log TO service_role;

ALTER TABLE public.integration_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY isl_select ON public.integration_sync_log FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY isl_insert ON public.integration_sync_log FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE INDEX idx_isl_conn ON public.integration_sync_log(connection_id, started_at DESC);
CREATE INDEX idx_isl_org ON public.integration_sync_log(organization_id, started_at DESC);
