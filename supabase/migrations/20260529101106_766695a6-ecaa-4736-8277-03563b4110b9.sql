-- 1) Tabela
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  company_id uuid,
  contact_id uuid,
  deal_id uuid,
  number text,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open', -- open | paid | overdue | canceled
  issued_at date NOT NULL DEFAULT (now()::date),
  due_date date NOT NULL,
  paid_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_org_status ON public.invoices(organization_id, status);
CREATE INDEX idx_invoices_due ON public.invoices(organization_id, due_date);
CREATE INDEX idx_invoices_company ON public.invoices(company_id);

-- 2) GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

-- 3) RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 4) Policies
CREATE POLICY "invoices_select_member"
  ON public.invoices FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "invoices_insert_member"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "invoices_update_member"
  ON public.invoices FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "invoices_delete_admin"
  ON public.invoices FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

-- 5) updated_at trigger
CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();