
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  company_id UUID,
  contact_id UUID,
  plan_name TEXT NOT NULL,
  mrr NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','quarterly','yearly')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  renewal_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','paused','expired')),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subs_org ON public.subscriptions(organization_id);
CREATE INDEX idx_subs_renewal ON public.subscriptions(organization_id, renewal_date);
CREATE INDEX idx_subs_company ON public.subscriptions(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view subscriptions"
ON public.subscriptions FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members create subscriptions"
ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Members update subscriptions"
ON public.subscriptions FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins delete subscriptions"
ON public.subscriptions FOR DELETE TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[])
);

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
