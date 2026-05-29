CREATE TABLE public.sales_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  target_revenue numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, period_month)
);

CREATE INDEX idx_quotas_org_period ON public.sales_quotas(organization_id, period_month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_quotas TO authenticated;
GRANT ALL ON public.sales_quotas TO service_role;

ALTER TABLE public.sales_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotas_select_members" ON public.sales_quotas
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "quotas_insert_admins" ON public.sales_quotas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE POLICY "quotas_update_admins" ON public.sales_quotas
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE POLICY "quotas_delete_admins" ON public.sales_quotas
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER set_quotas_updated_at
  BEFORE UPDATE ON public.sales_quotas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();