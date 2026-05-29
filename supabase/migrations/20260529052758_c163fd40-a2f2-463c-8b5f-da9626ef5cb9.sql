CREATE TABLE public.sales_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NULL,
  period_month DATE NOT NULL,
  target_value NUMERIC(14,2) NOT NULL CHECK (target_value >= 0),
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, period_month)
);

CREATE INDEX idx_sales_goals_org_period ON public.sales_goals (organization_id, period_month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_goals TO authenticated;
GRANT ALL ON public.sales_goals TO service_role;

ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org goals"
ON public.sales_goals FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins can insert goals"
ON public.sales_goals FOR INSERT TO authenticated
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE POLICY "Admins can update goals"
ON public.sales_goals FOR UPDATE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE POLICY "Admins can delete goals"
ON public.sales_goals FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER trg_sales_goals_updated_at
BEFORE UPDATE ON public.sales_goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();