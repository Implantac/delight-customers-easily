CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  category TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read templates"
ON public.message_templates FOR SELECT
TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "members insert templates"
ON public.message_templates FOR INSERT
TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "owners update templates"
ON public.message_templates FOR UPDATE
TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (created_by = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]))
);

CREATE POLICY "owners delete templates"
ON public.message_templates FOR DELETE
TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (created_by = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]))
);

CREATE INDEX idx_message_templates_org ON public.message_templates(organization_id);

CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();