CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','reimbursed','rejected')),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  receipt_url TEXT,
  notes TEXT,
  decided_at TIMESTAMPTZ,
  decided_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_org_status ON public.expenses(organization_id, status);
CREATE INDEX idx_expenses_user ON public.expenses(user_id);
CREATE INDEX idx_expenses_date ON public.expenses(organization_id, expense_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select_own_or_admin"
ON public.expenses FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (
    user_id = auth.uid()
    OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role])
  )
);

CREATE POLICY "expenses_insert_self"
ON public.expenses FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "expenses_update_owner_or_admin"
ON public.expenses FOR UPDATE TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (
    public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role])
    OR (user_id = auth.uid() AND status = 'pending')
  )
)
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "expenses_delete_admin"
ON public.expenses FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE TRIGGER expenses_set_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();