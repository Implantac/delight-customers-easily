
-- Commission payouts (snapshots mensais)
CREATE TABLE public.commission_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  period_month date NOT NULL,
  rule_id uuid REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  sold_value numeric(14,2) NOT NULL DEFAULT 0,
  deals_count integer NOT NULL DEFAULT 0,
  goal_value numeric(14,2) NOT NULL DEFAULT 0,
  base_commission numeric(14,2) NOT NULL DEFAULT 0,
  accelerator numeric(14,2) NOT NULL DEFAULT 0,
  bonus numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','paid')),
  notes text,
  locked_at timestamptz,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_payouts TO authenticated;
GRANT ALL ON public.commission_payouts TO service_role;

ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payouts_select_members" ON public.commission_payouts
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "payouts_write_admins" ON public.commission_payouts
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE INDEX idx_payouts_org_period ON public.commission_payouts(organization_id, period_month DESC);
CREATE INDEX idx_payouts_user ON public.commission_payouts(user_id, period_month DESC);

CREATE TRIGGER set_payouts_updated_at BEFORE UPDATE ON public.commission_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Aceite público de proposta
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by_name text,
  ADD COLUMN IF NOT EXISTS accepted_by_email text;

-- RPC pública para buscar proposta por share_token (sem auth)
CREATE OR REPLACE FUNCTION public.get_public_proposal(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.proposals%ROWTYPE;
  org_name text;
  items jsonb;
BEGIN
  SELECT * INTO p FROM public.proposals WHERE share_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT name INTO org_name FROM public.organizations WHERE id = p.organization_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'description', description,
    'quantity', quantity,
    'unit_price', unit_price,
    'discount_percent', discount_percent,
    'sort_order', sort_order
  ) ORDER BY sort_order), '[]'::jsonb) INTO items
  FROM public.proposal_items WHERE proposal_id = p.id;

  RETURN jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'status', p.status,
    'valid_until', p.valid_until,
    'notes', p.notes,
    'subtotal', p.subtotal,
    'discount_percent', p.discount_percent,
    'total', p.total,
    'accepted_at', p.accepted_at,
    'rejected_at', p.rejected_at,
    'organization_name', org_name,
    'items', items
  );
END $$;

REVOKE ALL ON FUNCTION public.get_public_proposal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_proposal(uuid) TO anon, authenticated;

-- RPC pública para registrar aceite/recusa via token
CREATE OR REPLACE FUNCTION public.respond_public_proposal(
  _token uuid, _action text, _name text, _email text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.proposals%ROWTYPE;
BEGIN
  IF _action NOT IN ('accept','reject') THEN
    RAISE EXCEPTION 'Ação inválida';
  END IF;
  SELECT * INTO p FROM public.proposals WHERE share_token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p.status IN ('accepted','rejected') THEN RETURN false; END IF;

  IF _action = 'accept' THEN
    UPDATE public.proposals SET
      status = 'accepted',
      accepted_at = now(),
      accepted_by_name = _name,
      accepted_by_email = _email
    WHERE id = p.id;
  ELSE
    UPDATE public.proposals SET
      status = 'rejected',
      rejected_at = now(),
      accepted_by_name = _name,
      accepted_by_email = _email
    WHERE id = p.id;
  END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.respond_public_proposal(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_public_proposal(uuid,text,text,text) TO anon, authenticated;
