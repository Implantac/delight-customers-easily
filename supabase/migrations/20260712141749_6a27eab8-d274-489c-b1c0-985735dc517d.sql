CREATE TABLE public.use_success_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  computed_at timestamptz NOT NULL DEFAULT now(),
  score int NOT NULL,
  classification text NOT NULL,
  pillars jsonb NOT NULL DEFAULT '[]'::jsonb,
  revenue jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX use_success_snapshots_org_time_idx
  ON public.use_success_snapshots (organization_id, computed_at DESC);

GRANT SELECT, INSERT ON public.use_success_snapshots TO authenticated;
GRANT ALL ON public.use_success_snapshots TO service_role;

ALTER TABLE public.use_success_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read use_success_snapshots"
  ON public.use_success_snapshots
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "members insert use_success_snapshots"
  ON public.use_success_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));