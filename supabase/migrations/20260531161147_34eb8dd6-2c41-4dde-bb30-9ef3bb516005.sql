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
      COALESCE(c.trade_name, c.legal_name) AS display_name,
      c.document AS cnpj,
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
    WHERE organization_id = _org AND stage NOT IN ('won', 'lost') AND company_id IS NOT NULL
    GROUP BY company_id
  ),
  deals_won AS (
    SELECT company_id, COUNT(*) AS cnt, COALESCE(SUM(value), 0) AS val
    FROM public.deals
    WHERE organization_id = _org AND stage = 'won'
      AND closed_at >= now() - INTERVAL '365 days' AND company_id IS NOT NULL
    GROUP BY company_id
  ),
  acts AS (
    SELECT d.company_id,
           MAX(a.created_at) AS last_at,
           COUNT(*) FILTER (WHERE a.created_at >= now() - INTERVAL '30 days') AS cnt30
    FROM public.activities a
    JOIN public.deals d ON d.id = a.deal_id
    WHERE a.organization_id = _org AND d.company_id IS NOT NULL
    GROUP BY d.company_id
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