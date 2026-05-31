-- Estender sales_goals com campos opcionais
ALTER TABLE public.sales_goals
  ADD COLUMN IF NOT EXISTS target_deals_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS notes text;

-- Tabela de snapshots de forecast
CREATE TABLE public.sales_forecast_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  scope text NOT NULL DEFAULT 'org' CHECK (scope IN ('org','user')),
  user_id uuid,
  open_pipeline_value numeric NOT NULL DEFAULT 0,
  weighted_forecast numeric NOT NULL DEFAULT 0,
  open_deals_count integer NOT NULL DEFAULT 0,
  won_value_period numeric NOT NULL DEFAULT 0,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_forecast_snap_org_period ON public.sales_forecast_snapshots(organization_id, period_start, period_end);

GRANT SELECT ON public.sales_forecast_snapshots TO authenticated;
GRANT ALL ON public.sales_forecast_snapshots TO service_role;

ALTER TABLE public.sales_forecast_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forecast_snap_select" ON public.sales_forecast_snapshots
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- RPC: atingimento de meta (period_month é o 1º dia do mês alvo)
CREATE OR REPLACE FUNCTION public.get_goal_attainment_v2(_goal_id uuid)
RETURNS TABLE(
  goal_id uuid,
  target_value numeric,
  target_deals_count integer,
  realized_value numeric,
  realized_deals_count bigint,
  attainment_pct numeric,
  period_start date,
  period_end date
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g public.sales_goals%ROWTYPE;
  p_start date;
  p_end date;
BEGIN
  SELECT * INTO g FROM public.sales_goals WHERE id = _goal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meta não encontrada'; END IF;
  IF NOT public.is_org_member(g.organization_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  p_start := date_trunc('month', g.period_month)::date;
  p_end := (date_trunc('month', g.period_month) + interval '1 month - 1 day')::date;

  RETURN QUERY
  WITH won AS (
    SELECT COALESCE(SUM(value),0) AS v, COUNT(*) AS c
    FROM public.deals d
    WHERE d.organization_id = g.organization_id
      AND d.stage = 'won'
      AND d.closed_at::date BETWEEN p_start AND p_end
      AND (g.user_id IS NULL OR d.owner_id = g.user_id)
  )
  SELECT
    g.id,
    g.target_value,
    g.target_deals_count,
    won.v::numeric,
    won.c::bigint,
    CASE WHEN g.target_value > 0 THEN ROUND((won.v / g.target_value) * 100, 2) ELSE NULL END,
    p_start,
    p_end
  FROM won;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_goal_attainment_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_goal_attainment_v2(uuid) TO authenticated;

-- RPC: compute_sales_forecast
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
    AND (expected_close_date IS NULL OR expected_close_date BETWEEN _period_start AND _period_end);

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

REVOKE EXECUTE ON FUNCTION public.compute_sales_forecast(uuid, date, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_sales_forecast(uuid, date, date, jsonb) TO authenticated;