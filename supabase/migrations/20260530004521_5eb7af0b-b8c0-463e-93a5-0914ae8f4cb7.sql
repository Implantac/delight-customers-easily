
CREATE TABLE public.sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sequence_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  step_order INT NOT NULL,
  day_offset INT NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('call','email','task','meeting','note')),
  subject TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sequence_steps_seq ON public.sequence_steps(sequence_id, step_order);

CREATE TABLE public.sequence_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  sequence_id UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','cancelled')),
  enrolled_by UUID NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (sequence_id, contact_id)
);

CREATE INDEX idx_enrollments_org ON public.sequence_enrollments(organization_id);
CREATE INDEX idx_enrollments_contact ON public.sequence_enrollments(contact_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sequences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sequence_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sequence_enrollments TO authenticated;
GRANT ALL ON public.sequences TO service_role;
GRANT ALL ON public.sequence_steps TO service_role;
GRANT ALL ON public.sequence_enrollments TO service_role;

ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view sequences"
ON public.sequences FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins insert sequences"
ON public.sequences FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[])
  AND created_by = auth.uid()
);

CREATE POLICY "Admins update sequences"
ON public.sequences FOR UPDATE TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[])
);

CREATE POLICY "Admins delete sequences"
ON public.sequences FOR DELETE TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[])
);

CREATE POLICY "Members view steps"
ON public.sequence_steps FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins write steps"
ON public.sequence_steps FOR ALL TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[])
)
WITH CHECK (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[])
);

CREATE POLICY "Members view enrollments"
ON public.sequence_enrollments FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members create enrollments"
ON public.sequence_enrollments FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(organization_id, auth.uid())
  AND enrolled_by = auth.uid()
);

CREATE POLICY "Members update enrollments"
ON public.sequence_enrollments FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members delete enrollments"
ON public.sequence_enrollments FOR DELETE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER update_sequences_updated_at
BEFORE UPDATE ON public.sequences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
