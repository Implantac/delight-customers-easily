CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  contact_id UUID,
  assignee_id UUID,
  created_by UUID NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','pending','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  channel TEXT,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_org_status ON public.tickets(organization_id, status);
CREATE INDEX idx_tickets_assignee ON public.tickets(assignee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select" ON public.tickets FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "tickets_insert" ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "tickets_delete" ON public.tickets FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ticket_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments(ticket_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_comments TO authenticated;
GRANT ALL ON public.ticket_comments TO service_role;

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_comments_select" ON public.ticket_comments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "ticket_comments_insert" ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND author_id = auth.uid());
CREATE POLICY "ticket_comments_update" ON public.ticket_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY "ticket_comments_delete" ON public.ticket_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));