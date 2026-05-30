
CREATE TABLE public.onboarding_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL DEFAULT 30,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_templates TO authenticated;
GRANT ALL ON public.onboarding_templates TO service_role;
ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view templates" ON public.onboarding_templates FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert templates" ON public.onboarding_templates FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members update templates" ON public.onboarding_templates FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers delete templates" ON public.onboarding_templates FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

CREATE TRIGGER trg_onboarding_templates_updated BEFORE UPDATE ON public.onboarding_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_onb_templates_org ON public.onboarding_templates(organization_id);

CREATE TABLE public.onboarding_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  template_id UUID REFERENCES public.onboarding_templates(id) ON DELETE SET NULL,
  company_id UUID,
  contact_id UUID,
  name TEXT NOT NULL,
  owner_id UUID,
  status TEXT NOT NULL DEFAULT 'not_started',
  health TEXT NOT NULL DEFAULT 'green',
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress_pct INTEGER NOT NULL DEFAULT 0,
  started_at DATE,
  due_at DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_projects TO authenticated;
GRANT ALL ON public.onboarding_projects TO service_role;
ALTER TABLE public.onboarding_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view projects" ON public.onboarding_projects FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert projects" ON public.onboarding_projects FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members update projects" ON public.onboarding_projects FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers delete projects" ON public.onboarding_projects FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

CREATE TRIGGER trg_onboarding_projects_updated BEFORE UPDATE ON public.onboarding_projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_onb_projects_org ON public.onboarding_projects(organization_id, status, due_at);
