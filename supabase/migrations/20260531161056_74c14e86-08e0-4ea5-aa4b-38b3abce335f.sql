-- Phase 4: Customer 360 snapshot

CREATE TABLE IF NOT EXISTS public.customer_360_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  erp_customer_id uuid REFERENCES public.erp_customers(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,

  -- identity
  display_name text,
  cnpj text,
  primary_email text,
  primary_phone text,

  -- erp metrics
  rfm_segment text,
  recency_days int,
  frequency int,
  monetary numeric,
  last_purchase_at timestamptz,
  trend text,

  -- crm metrics
  open_deals_count int NOT NULL DEFAULT 0,
  open_deals_value numeric NOT NULL DEFAULT 0,
  won_deals_count_365d int NOT NULL DEFAULT 0,
  won_deals_value_365d numeric NOT NULL DEFAULT 0,
  last_activity_at timestamptz,
  activities_30d int NOT NULL DEFAULT 0,

  -- channels
  has_whatsapp boolean NOT NULL DEFAULT false,
  has_email boolean NOT NULL DEFAULT false,

  -- meta
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, erp_customer_id),
  UNIQUE (organization_id, company_id)
);

CREATE INDEX IF NOT EXISTS customer_360_org_idx ON public.customer_360_snapshot(organization_id);
CREATE INDEX IF NOT EXISTS customer_360_segment_idx ON public.customer_360_snapshot(organization_id, rfm_segment);
CREATE INDEX IF NOT EXISTS customer_360_monetary_idx ON public.customer_360_snapshot(organization_id, monetary DESC);

GRANT SELECT ON public.customer_360_snapshot TO authenticated;
GRANT ALL ON public.customer_360_snapshot TO service_role;

ALTER TABLE public.customer_360_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "c360 members read"
  ON public.customer_360_snapshot FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "c360 service manage"
  ON public.customer_360_snapshot FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_customer_360_touch
  BEFORE UPDATE ON public.customer_360_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Refresh function: rebuilds snapshot for one organization
CREATE OR REPLACE FUNCTION public.refresh_customer_360(_org uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  WITH erp_base AS (
    SELECT
      c.id AS erp_customer_id,
      c.organization_id,
      c.company_id,
      COALESCE(c.fantasy_name, c.legal_name, c.name) AS display_name,
      c.cnpj,
      c.email AS primary_email,
      c.phone AS primary_phone,
      c.last_purchase_at,
      m.rfm_segment,
      m.recency_days,
      m.frequency,
      m.monetary,
      m.trend
    FROM public.erp_customers c
    LEFT JOIN public.erp_customer_metrics m
      ON m.erp_customer_id = c.id AND m.organization_id = c.organization_id
    WHERE c.organization_id = _org
  ),
  deals_open AS (
    SELECT company_id, COUNT(*) AS cnt, COALESCE(SUM(value), 0) AS val
    FROM public.deals
    WHERE organization_id = _org AND stage NOT IN ('won', 'lost')
    GROUP BY company_id
  ),
  deals_won AS (
    SELECT company_id, COUNT(*) AS cnt, COALESCE(SUM(value), 0) AS val
    FROM public.deals
    WHERE organization_id = _org AND stage = 'won'
      AND closed_at >= now() - INTERVAL '365 days'
    GROUP BY company_id
  ),
  acts AS (
    SELECT company_id,
           MAX(created_at) AS last_at,
           COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '30 days') AS cnt30
    FROM public.activities
    WHERE organization_id = _org
    GROUP BY company_id
  )
  INSERT INTO public.customer_360_snapshot (
    organization_id, erp_customer_id, company_id,
    display_name, cnpj, primary_email, primary_phone,
    rfm_segment, recency_days, frequency, monetary, last_purchase_at, trend,
    open_deals_count, open_deals_value,
    won_deals_count_365d, won_deals_value_365d,
    last_activity_at, activities_30d,
    has_whatsapp, has_email, computed_at
  )
  SELECT
    e.organization_id, e.erp_customer_id, e.company_id,
    e.display_name, e.cnpj, e.primary_email, e.primary_phone,
    e.rfm_segment, e.recency_days, e.frequency, e.monetary, e.last_purchase_at, e.trend,
    COALESCE(d_open.cnt, 0)::int, COALESCE(d_open.val, 0),
    COALESCE(d_won.cnt, 0)::int,  COALESCE(d_won.val, 0),
    a.last_at, COALESCE(a.cnt30, 0)::int,
    (e.primary_phone IS NOT NULL),
    (e.primary_email IS NOT NULL),
    now()
  FROM erp_base e
  LEFT JOIN deals_open d_open ON d_open.company_id = e.company_id
  LEFT JOIN deals_won  d_won  ON d_won.company_id  = e.company_id
  LEFT JOIN acts       a      ON a.company_id      = e.company_id
  ON CONFLICT (organization_id, erp_customer_id)
  DO UPDATE SET
    company_id           = EXCLUDED.company_id,
    display_name         = EXCLUDED.display_name,
    cnpj                 = EXCLUDED.cnpj,
    primary_email        = EXCLUDED.primary_email,
    primary_phone        = EXCLUDED.primary_phone,
    rfm_segment          = EXCLUDED.rfm_segment,
    recency_days         = EXCLUDED.recency_days,
    frequency            = EXCLUDED.frequency,
    monetary             = EXCLUDED.monetary,
    last_purchase_at     = EXCLUDED.last_purchase_at,
    trend                = EXCLUDED.trend,
    open_deals_count     = EXCLUDED.open_deals_count,
    open_deals_value     = EXCLUDED.open_deals_value,
    won_deals_count_365d = EXCLUDED.won_deals_count_365d,
    won_deals_value_365d = EXCLUDED.won_deals_value_365d,
    last_activity_at     = EXCLUDED.last_activity_at,
    activities_30d       = EXCLUDED.activities_30d,
    has_whatsapp         = EXCLUDED.has_whatsapp,
    has_email            = EXCLUDED.has_email,
    computed_at          = EXCLUDED.computed_at,
    updated_at           = now();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END $$;

REVOKE EXECUTE ON FUNCTION public.refresh_customer_360(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_customer_360(uuid) TO service_role;