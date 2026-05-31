
-- Aceitar bling e custom
ALTER TABLE public.erp_integrations DROP CONSTRAINT IF EXISTS erp_integrations_provider_check;
ALTER TABLE public.erp_integrations ADD CONSTRAINT erp_integrations_provider_check
  CHECK (provider IN ('omie','bling','custom'));

-- Log de entrada do webhook universal
CREATE TABLE public.erp_inbound_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  entity text NOT NULL,
  external_id text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX erp_inbound_log_org_idx ON public.erp_inbound_log(organization_id, created_at DESC);

GRANT SELECT ON public.erp_inbound_log TO authenticated;
GRANT ALL ON public.erp_inbound_log TO service_role;
ALTER TABLE public.erp_inbound_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_inbound_log_admin_read" ON public.erp_inbound_log
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

-- Mapeamento de campos
CREATE TABLE public.erp_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  entity text NOT NULL,
  source_field text NOT NULL,
  target_field text NOT NULL,
  transform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider, entity, source_field)
);
CREATE INDEX erp_field_mappings_org_idx ON public.erp_field_mappings(organization_id, provider, entity);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_field_mappings TO authenticated;
GRANT ALL ON public.erp_field_mappings TO service_role;
ALTER TABLE public.erp_field_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_field_mappings_admin_all" ON public.erp_field_mappings
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE TRIGGER erp_field_mappings_set_updated_at
  BEFORE UPDATE ON public.erp_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
