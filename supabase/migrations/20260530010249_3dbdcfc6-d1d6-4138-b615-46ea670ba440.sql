CREATE TABLE public.territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  default_owner_id UUID,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_territories_org ON public.territories(organization_id);

CREATE TABLE public.territory_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('country','state','city','industry','revenue_min','revenue_max','tag')),
  operator TEXT NOT NULL DEFAULT 'equals' CHECK (operator IN ('equals','contains','gte','lte','in')),
  value TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_territory_rules_territory ON public.territory_rules(territory_id);
CREATE INDEX idx_territory_rules_org ON public.territory_rules(organization_id);

CREATE TABLE public.territory_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (territory_id, user_id)
);
CREATE INDEX idx_territory_members_territory ON public.territory_members(territory_id);
CREATE INDEX idx_territory_members_org ON public.territory_members(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.territories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.territory_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.territory_members TO authenticated;
GRANT ALL ON public.territories TO service_role;
GRANT ALL ON public.territory_rules TO service_role;
GRANT ALL ON public.territory_members TO service_role;

ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "territories_select_member" ON public.territories FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "territories_write_admin" ON public.territories FOR ALL TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE POLICY "territory_rules_select_member" ON public.territory_rules FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "territory_rules_write_admin" ON public.territory_rules FOR ALL TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE POLICY "territory_members_select_member" ON public.territory_members FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "territory_members_write_admin" ON public.territory_members FOR ALL TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE TRIGGER territories_set_updated_at BEFORE UPDATE ON public.territories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();