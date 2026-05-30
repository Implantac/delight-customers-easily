CREATE TABLE public.surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'nps' CHECK (type IN ('nps','csat','ces','custom')),
  question TEXT NOT NULL DEFAULT 'O quanto você recomendaria nosso produto?',
  scale_min INTEGER NOT NULL DEFAULT 0,
  scale_max INTEGER NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.survey_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  contact_id UUID,
  company_id UUID,
  deal_id UUID,
  score INTEGER NOT NULL,
  comment TEXT,
  respondent_email TEXT,
  respondent_name TEXT,
  source TEXT,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT ALL ON public.surveys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view surveys" ON public.surveys FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers manage surveys" ON public.surveys FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));

CREATE POLICY "members view responses" ON public.survey_responses FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert responses" ON public.survey_responses FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers update responses" ON public.survey_responses FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));
CREATE POLICY "managers delete responses" ON public.survey_responses FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));

CREATE INDEX idx_surveys_org ON public.surveys(organization_id);
CREATE INDEX idx_survey_responses_survey ON public.survey_responses(survey_id);
CREATE INDEX idx_survey_responses_org ON public.survey_responses(organization_id);

CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();