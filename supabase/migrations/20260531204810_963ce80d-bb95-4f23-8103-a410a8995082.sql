
CREATE TABLE public.erp_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.erp_integrations(id) ON DELETE CASCADE,
  entity text NOT NULL,
  action text NOT NULL CHECK (action IN ('create','update','delete')),
  external_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed','needs_manual','cancelled')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  last_error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX erp_outbox_status_sched_idx ON public.erp_outbox(status, scheduled_at);
CREATE INDEX erp_outbox_org_idx ON public.erp_outbox(organization_id, status);
CREATE INDEX erp_outbox_integration_idx ON public.erp_outbox(integration_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_outbox TO authenticated;
GRANT ALL ON public.erp_outbox TO service_role;

ALTER TABLE public.erp_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_outbox_member_read" ON public.erp_outbox
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "erp_outbox_admin_write" ON public.erp_outbox
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE POLICY "erp_outbox_admin_update" ON public.erp_outbox
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE POLICY "erp_outbox_admin_delete" ON public.erp_outbox
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE TRIGGER erp_outbox_set_updated_at
  BEFORE UPDATE ON public.erp_outbox
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
