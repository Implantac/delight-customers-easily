ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_id text;

CREATE INDEX IF NOT EXISTS activities_org_source_idx
  ON public.activities (organization_id, source_kind, source_id);

CREATE INDEX IF NOT EXISTS activities_org_company_idx
  ON public.activities (organization_id, company_id);