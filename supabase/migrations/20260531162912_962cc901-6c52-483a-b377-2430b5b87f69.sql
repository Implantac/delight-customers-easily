CREATE OR REPLACE FUNCTION public.compute_sales_forecast(
  _org uuid,
  _period_start date,
  _period_end date,
  _weights jsonb DEFAULT '{"lead":0.1,"qualified":0.25,"proposal":0.5,"negotiation":0.75}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snap_id uuid;
  v_open_pipe numeric := 0;
  v_weighted numeric := 0;
  v_open_count int := 0;
  v_won numeric := 0;
BEGIN
  IF NOT public.has_org_role(_org, auth.uid(), ARRAY['owner','admin']::org_role[]) THEN
    RAISE EXCEPTION 'Acesso negado: requer owner/admin';
  END IF;

  SELECT
    COALESCE(SUM(value), 0),
    COALESCE(SUM(value * COALESCE((_weights ->> stage::text)::numeric, 0.3)), 0),
    COUNT(*)
  INTO v_open_pipe, v_weighted, v_open_count
  FROM public.deals
  WHERE organization_id = _org
    AND stage NOT IN ('won','lost')
    AND (expected_close IS NULL OR expected_close BETWEEN _period_start AND _period_end);

  SELECT COALESCE(SUM(value), 0) INTO v_won
  FROM public.deals
  WHERE organization_id = _org
    AND stage = 'won'
    AND closed_at::date BETWEEN _period_start AND _period_end;

  INSERT INTO public.sales_forecast_snapshots(
    organization_id, period_start, period_end, scope,
    open_pipeline_value, weighted_forecast, open_deals_count, won_value_period, weights
  ) VALUES (
    _org, _period_start, _period_end, 'org',
    v_open_pipe, v_weighted, v_open_count, v_won, _weights
  ) RETURNING id INTO snap_id;

  RETURN snap_id;
END $$;