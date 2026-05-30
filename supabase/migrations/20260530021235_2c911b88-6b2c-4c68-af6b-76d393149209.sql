CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'in_stock',
  cost NUMERIC(12,2) DEFAULT 0,
  purchased_at DATE,
  warranty_until DATE,
  notes TEXT,
  current_company_id UUID,
  current_contact_id UUID,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.asset_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  company_id UUID,
  contact_id UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at TIMESTAMPTZ,
  notes TEXT,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_org ON public.assets(organization_id);
CREATE INDEX idx_assets_status ON public.assets(status);
CREATE INDEX idx_asset_assign_asset ON public.asset_assignments(asset_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_assignments TO authenticated;
GRANT ALL ON public.asset_assignments TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_member_select" ON public.assets
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "assets_member_insert" ON public.assets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "assets_member_update" ON public.assets
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "assets_admin_delete" ON public.assets
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));

CREATE POLICY "asset_assign_member_select" ON public.asset_assignments
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "asset_assign_member_insert" ON public.asset_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "asset_assign_member_update" ON public.asset_assignments
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "asset_assign_admin_delete" ON public.asset_assignments
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));

CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();