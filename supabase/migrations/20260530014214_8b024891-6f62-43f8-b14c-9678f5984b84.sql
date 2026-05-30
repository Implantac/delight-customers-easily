CREATE TABLE public.lead_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  redirect_url text,
  success_message text,
  create_contact boolean NOT NULL DEFAULT true,
  create_deal boolean NOT NULL DEFAULT false,
  default_source text,
  default_owner_id uuid,
  notify_emails text[],
  submissions_count int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  form_id uuid NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  email text,
  name text,
  phone text,
  contact_id uuid,
  deal_id uuid,
  source_url text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_forms_org ON public.lead_forms(organization_id, active);
CREATE INDEX idx_lead_form_subs_form ON public.lead_form_submissions(form_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_forms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_form_submissions TO authenticated;
GRANT ALL ON public.lead_forms TO service_role;
GRANT ALL ON public.lead_form_submissions TO service_role;

ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view lead forms" ON public.lead_forms FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers manage lead forms" ON public.lead_forms FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::public.org_role[]));

CREATE POLICY "members view submissions" ON public.lead_form_submissions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers delete submissions" ON public.lead_form_submissions FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::public.org_role[]));

CREATE TRIGGER trg_lead_forms_updated BEFORE UPDATE ON public.lead_forms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();