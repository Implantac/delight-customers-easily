CREATE TYPE public.signature_status AS ENUM ('draft','sent','viewed','signed','declined','expired','cancelled');
CREATE TYPE public.signer_status AS ENUM ('pending','viewed','signed','declined');

CREATE TABLE public.signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  document_url text,
  contract_id uuid,
  deal_id uuid,
  company_id uuid,
  status public.signature_status NOT NULL DEFAULT 'draft',
  expires_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.signature_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  request_id uuid NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text,
  position int NOT NULL DEFAULT 0,
  status public.signer_status NOT NULL DEFAULT 'pending',
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sig_req_org ON public.signature_requests(organization_id, status);
CREATE INDEX idx_sig_signer_req ON public.signature_signers(request_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_signers TO authenticated;
GRANT ALL ON public.signature_requests TO service_role;
GRANT ALL ON public.signature_signers TO service_role;

ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_signers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view sig req" ON public.signature_requests FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members create sig req" ON public.signature_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "members update sig req" ON public.signature_requests FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers delete sig req" ON public.signature_requests FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::public.org_role[]));

CREATE POLICY "members view signers" ON public.signature_signers FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members manage signers" ON public.signature_signers FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_sig_req_updated BEFORE UPDATE ON public.signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();