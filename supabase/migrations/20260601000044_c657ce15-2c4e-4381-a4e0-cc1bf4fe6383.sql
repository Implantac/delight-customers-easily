-- Trigger: espelhar churn em ai_prediction_outcomes
CREATE OR REPLACE FUNCTION public.mirror_churn_to_outcomes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT org_tenant_root(NEW.organization_id) INTO v_tenant;
  IF v_tenant IS NULL THEN v_tenant := NEW.organization_id; END IF;
  INSERT INTO public.ai_prediction_outcomes
    (tenant_id, org_id, prediction_type, customer_id, predicted_at, predicted_score, predicted_label, horizon_days, model_version)
  VALUES
    (v_tenant, NEW.organization_id, 'churn', NEW.erp_customer_id, NEW.computed_at, NEW.churn_probability, NEW.risk_level, 30, NEW.model);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_churn_to_outcomes ON public.ai_churn_predictions;
CREATE TRIGGER trg_mirror_churn_to_outcomes
  AFTER INSERT OR UPDATE OF churn_probability, computed_at ON public.ai_churn_predictions
  FOR EACH ROW EXECUTE FUNCTION public.mirror_churn_to_outcomes();

-- Trigger: espelhar recompra em ai_prediction_outcomes
CREATE OR REPLACE FUNCTION public.mirror_repurchase_to_outcomes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_horizon int;
BEGIN
  SELECT org_tenant_root(NEW.organization_id) INTO v_tenant;
  IF v_tenant IS NULL THEN v_tenant := NEW.organization_id; END IF;
  v_horizon := COALESCE(EXTRACT(EPOCH FROM (NEW.expected_purchase_at - NEW.computed_at)) / 86400, 30)::int;
  IF v_horizon < 1 THEN v_horizon := 30; END IF;
  INSERT INTO public.ai_prediction_outcomes
    (tenant_id, org_id, prediction_type, customer_id, predicted_at, predicted_score, predicted_label, horizon_days, model_version)
  VALUES
    (v_tenant, NEW.organization_id, 'repurchase', NEW.erp_customer_id, NEW.computed_at,
     COALESCE(NEW.confidence, 0.5), 'expected_purchase', v_horizon, NEW.model);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_repurchase_to_outcomes ON public.ai_repurchase_predictions;
CREATE TRIGGER trg_mirror_repurchase_to_outcomes
  AFTER INSERT OR UPDATE OF confidence, expected_purchase_at, computed_at ON public.ai_repurchase_predictions
  FOR EACH ROW EXECUTE FUNCTION public.mirror_repurchase_to_outcomes();

-- Observador: fecha o ciclo comparando com vendas reais (erp_sales_history)
CREATE OR REPLACE FUNCTION public.close_ai_prediction_outcomes(_tenant_id uuid)
RETURNS TABLE(closed bigint, churn_closed bigint, repurchase_closed bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_churn bigint := 0;
  v_rep bigint := 0;
BEGIN
  -- Fecha churn: acerto = NÃO houve compra no horizonte
  WITH pending AS (
    SELECT o.id, o.customer_id, o.predicted_at, o.horizon_days, o.predicted_score
    FROM public.ai_prediction_outcomes o
    WHERE o.tenant_id = _tenant_id
      AND o.prediction_type = 'churn'
      AND o.observed_outcome IS NULL
      AND o.predicted_at + (o.horizon_days || ' days')::interval <= now()
  ),
  evaluated AS (
    SELECT p.id,
           NOT EXISTS (
             SELECT 1 FROM public.erp_sales_history s
             WHERE s.erp_customer_id = p.customer_id
               AND s.order_date > p.predicted_at
               AND s.order_date <= p.predicted_at + (p.horizon_days || ' days')::interval
           ) AS churned
    FROM pending p
  ),
  upd AS (
    UPDATE public.ai_prediction_outcomes o
    SET observed_outcome = e.churned, observed_at = now()
    FROM evaluated e
    WHERE o.id = e.id
    RETURNING o.id
  )
  SELECT count(*) INTO v_churn FROM upd;

  -- Fecha recompra: acerto = HOUVE compra no horizonte
  WITH pending AS (
    SELECT o.id, o.customer_id, o.predicted_at, o.horizon_days
    FROM public.ai_prediction_outcomes o
    WHERE o.tenant_id = _tenant_id
      AND o.prediction_type = 'repurchase'
      AND o.observed_outcome IS NULL
      AND o.predicted_at + (o.horizon_days || ' days')::interval <= now()
  ),
  evaluated AS (
    SELECT p.id,
           EXISTS (
             SELECT 1 FROM public.erp_sales_history s
             WHERE s.erp_customer_id = p.customer_id
               AND s.order_date > p.predicted_at
               AND s.order_date <= p.predicted_at + (p.horizon_days || ' days')::interval
           ) AS bought,
           (SELECT COALESCE(sum(s.total_value), 0) FROM public.erp_sales_history s
             WHERE s.erp_customer_id = p.customer_id
               AND s.order_date > p.predicted_at
               AND s.order_date <= p.predicted_at + (p.horizon_days || ' days')::interval) AS value_total
    FROM pending p
  ),
  upd AS (
    UPDATE public.ai_prediction_outcomes o
    SET observed_outcome = e.bought, observed_value = e.value_total, observed_at = now()
    FROM evaluated e
    WHERE o.id = e.id
    RETURNING o.id
  )
  SELECT count(*) INTO v_rep FROM upd;

  RETURN QUERY SELECT (v_churn + v_rep), v_churn, v_rep;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.close_ai_prediction_outcomes(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.close_ai_prediction_outcomes(uuid) TO authenticated, service_role;