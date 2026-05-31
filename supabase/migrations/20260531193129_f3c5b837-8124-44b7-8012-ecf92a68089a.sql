
CREATE TABLE public.automation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  trigger_event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('success','error','skipped')),
  error text,
  duration_ms int,
  started_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ar_select ON public.automation_runs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY ar_insert ON public.automation_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_ar_org_started ON public.automation_runs(organization_id, started_at DESC);
CREATE INDEX idx_ar_automation ON public.automation_runs(automation_id, started_at DESC);
