CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  requester_id UUID NOT NULL,
  approver_id UUID,
  type TEXT NOT NULL DEFAULT 'discount',
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14,2),
  currency TEXT DEFAULT 'BRL',
  reference_type TEXT,
  reference_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approvals_org_status ON public.approvals(organization_id, status);
CREATE INDEX idx_approvals_requester ON public.approvals(requester_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approvals_select_member"
ON public.approvals FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "approvals_insert_member"
ON public.approvals FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND requester_id = auth.uid());

CREATE POLICY "approvals_update_admin_or_requester"
ON public.approvals FOR UPDATE TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (
    public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role])
    OR (requester_id = auth.uid() AND status = 'pending')
  )
)
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "approvals_delete_admin"
ON public.approvals FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE TRIGGER approvals_set_updated_at
BEFORE UPDATE ON public.approvals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();