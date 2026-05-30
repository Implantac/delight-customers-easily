CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'sale' CHECK (type IN ('sale','nda','msa','sow','renewal','partnership','other')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','active','expiring','ended','cancelled')),
  company_id UUID,
  contact_id UUID,
  deal_id UUID,
  owner_id UUID,
  amount NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'BRL',
  start_date DATE,
  end_date DATE,
  signed_at TIMESTAMPTZ,
  renewal_alert_days INTEGER NOT NULL DEFAULT 30,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  document_url TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.contract_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created','sent','signed','amended','renewed','cancelled','ended','note')),
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contract_events TO authenticated;
GRANT ALL ON public.contract_events TO service_role;

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view contracts" ON public.contracts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members create contracts" ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "owners update contracts" ON public.contracts FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (owner_id = auth.uid() OR created_by = auth.uid()
         OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]))
  );
CREATE POLICY "managers delete contracts" ON public.contracts FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));

CREATE POLICY "members view contract events" ON public.contract_events FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert contract events" ON public.contract_events FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "managers delete contract events" ON public.contract_events FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));

CREATE INDEX idx_contracts_org ON public.contracts(organization_id);
CREATE INDEX idx_contracts_company ON public.contracts(company_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contracts_end_date ON public.contracts(end_date);
CREATE INDEX idx_contract_events_contract ON public.contract_events(contract_id);

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();