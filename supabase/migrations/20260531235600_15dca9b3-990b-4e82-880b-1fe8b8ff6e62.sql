-- 1) Fix search_path em função custom
CREATE OR REPLACE FUNCTION public.touch_updated_at_bank()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2) Infra de backtesting de IA Comercial
CREATE TABLE IF NOT EXISTS public.ai_prediction_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  org_id uuid,
  prediction_type text NOT NULL CHECK (prediction_type IN ('churn','repurchase','leadscore')),
  customer_id uuid,
  lead_id uuid,
  predicted_at timestamptz NOT NULL,
  predicted_score numeric NOT NULL,
  predicted_label text,
  horizon_days int NOT NULL DEFAULT 30,
  observed_at timestamptz,
  observed_outcome boolean,
  observed_value numeric,
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ai_prediction_outcomes TO authenticated;
GRANT ALL ON public.ai_prediction_outcomes TO service_role;

ALTER TABLE public.ai_prediction_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read outcomes"
  ON public.ai_prediction_outcomes FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), tenant_id));

CREATE POLICY "service role manages outcomes"
  ON public.ai_prediction_outcomes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ai_outcomes_tenant_type
  ON public.ai_prediction_outcomes (tenant_id, prediction_type, predicted_at DESC);

-- 3) Função de métricas de backtesting (precision/recall/accuracy por tipo)
CREATE OR REPLACE FUNCTION public.get_ai_backtest_metrics(_tenant_id uuid, _prediction_type text, _since timestamptz DEFAULT now() - interval '90 days')
RETURNS TABLE(
  total bigint,
  with_outcome bigint,
  accuracy numeric,
  precision_pos numeric,
  recall_pos numeric,
  avg_predicted numeric,
  positive_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT predicted_score, observed_outcome,
           (predicted_score >= 0.5) AS predicted_pos
    FROM public.ai_prediction_outcomes
    WHERE tenant_id = _tenant_id
      AND prediction_type = _prediction_type
      AND predicted_at >= _since
  ),
  obs AS (SELECT * FROM base WHERE observed_outcome IS NOT NULL)
  SELECT
    (SELECT count(*) FROM base) AS total,
    (SELECT count(*) FROM obs) AS with_outcome,
    CASE WHEN (SELECT count(*) FROM obs) = 0 THEN NULL
         ELSE round(avg(CASE WHEN predicted_pos = observed_outcome THEN 1 ELSE 0 END)::numeric, 4)
    END AS accuracy,
    CASE WHEN (SELECT count(*) FROM obs WHERE predicted_pos) = 0 THEN NULL
         ELSE round(((SELECT count(*) FROM obs WHERE predicted_pos AND observed_outcome)::numeric /
                     (SELECT count(*) FROM obs WHERE predicted_pos)::numeric), 4)
    END AS precision_pos,
    CASE WHEN (SELECT count(*) FROM obs WHERE observed_outcome) = 0 THEN NULL
         ELSE round(((SELECT count(*) FROM obs WHERE predicted_pos AND observed_outcome)::numeric /
                     (SELECT count(*) FROM obs WHERE observed_outcome)::numeric), 4)
    END AS recall_pos,
    round(avg(predicted_score)::numeric, 4) AS avg_predicted,
    CASE WHEN (SELECT count(*) FROM obs) = 0 THEN NULL
         ELSE round((SELECT count(*) FROM obs WHERE observed_outcome)::numeric /
                    (SELECT count(*) FROM obs)::numeric, 4)
    END AS positive_rate
  FROM obs;
$$;

REVOKE EXECUTE ON FUNCTION public.get_ai_backtest_metrics(uuid, text, timestamptz) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_ai_backtest_metrics(uuid, text, timestamptz) TO authenticated, service_role;