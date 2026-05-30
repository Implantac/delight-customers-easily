
-- 1) Tabela de integrações ERP por organização
CREATE TABLE IF NOT EXISTS public.erp_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('omie')),
  app_key text NOT NULL,
  app_secret text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);

CREATE INDEX IF NOT EXISTS erp_integrations_org_idx ON public.erp_integrations(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_integrations TO authenticated;
GRANT ALL ON public.erp_integrations TO service_role;

ALTER TABLE public.erp_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_integrations_admin_select" ON public.erp_integrations
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE POLICY "erp_integrations_admin_write" ON public.erp_integrations
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER erp_integrations_updated
  BEFORE UPDATE ON public.erp_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Marcadores de sincronização nos cadastros do CRM
ALTER TABLE public.contacts  ADD COLUMN IF NOT EXISTS omie_id bigint;
ALTER TABLE public.contacts  ADD COLUMN IF NOT EXISTS omie_synced_at timestamptz;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS omie_id bigint;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS omie_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS contacts_omie_id_idx  ON public.contacts(organization_id, omie_id);
CREATE INDEX IF NOT EXISTS companies_omie_id_idx ON public.companies(organization_id, omie_id);
