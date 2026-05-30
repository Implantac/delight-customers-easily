DROP TABLE IF EXISTS public.sales_quotas;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS outcome_reason text,
  ADD COLUMN IF NOT EXISTS outcome_notes text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_deals_closed_at ON public.deals(organization_id, closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_outcome ON public.deals(organization_id, stage, outcome_reason) WHERE stage IN ('won','lost');

CREATE OR REPLACE FUNCTION public.deals_set_closed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IN ('won','lost') AND (OLD.stage IS DISTINCT FROM NEW.stage OR NEW.closed_at IS NULL) THEN
    NEW.closed_at = COALESCE(NEW.closed_at, now());
  ELSIF NEW.stage NOT IN ('won','lost') THEN
    NEW.closed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_closed_at_trg ON public.deals;
CREATE TRIGGER deals_closed_at_trg
  BEFORE INSERT OR UPDATE OF stage, closed_at ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.deals_set_closed_at();