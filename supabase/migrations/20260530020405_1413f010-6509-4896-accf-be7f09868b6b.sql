CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INT NOT NULL DEFAULT 0,
  description TEXT,
  billable BOOLEAN NOT NULL DEFAULT true,
  hourly_rate NUMERIC(12,2) DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  billed BOOLEAN NOT NULL DEFAULT false,
  billed_at TIMESTAMPTZ,
  deal_id UUID,
  ticket_id UUID,
  company_id UUID,
  contact_id UUID,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_org_date ON public.time_entries(organization_id, entry_date DESC);
CREATE INDEX idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_deal ON public.time_entries(deal_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_member_select" ON public.time_entries
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "time_entries_member_insert" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "time_entries_owner_update" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid())
         AND (user_id = auth.uid()
              OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[])));

CREATE POLICY "time_entries_owner_delete" ON public.time_entries
  FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid())
         AND (user_id = auth.uid()
              OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[])));

CREATE TRIGGER trg_time_entries_updated_at BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();