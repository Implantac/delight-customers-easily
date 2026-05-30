CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  deal_id UUID,
  contact_id UUID,
  company_id UUID,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until DATE,
  notes TEXT,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  share_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.proposal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  product_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_items TO authenticated;
GRANT ALL ON public.proposal_items TO service_role;

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read proposals" ON public.proposals FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert proposals" ON public.proposals FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "owners update proposals" ON public.proposals FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()) AND (created_by = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[])));
CREATE POLICY "owners delete proposals" ON public.proposals FOR DELETE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()) AND (created_by = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[])));

CREATE POLICY "members read proposal_items" ON public.proposal_items FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members write proposal_items" ON public.proposal_items FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members update proposal_items" ON public.proposal_items FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members delete proposal_items" ON public.proposal_items FOR DELETE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_proposals_org ON public.proposals(organization_id);
CREATE INDEX idx_proposals_deal ON public.proposals(deal_id);
CREATE INDEX idx_proposal_items_proposal ON public.proposal_items(proposal_id);

CREATE TRIGGER update_proposals_updated_at
BEFORE UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();