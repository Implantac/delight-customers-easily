-- Phase 5: AI commercial predictions (persisted, with TTL)

-- 1) Lead scores (qualifica leads/contatos/empresas)
CREATE TABLE IF NOT EXISTS public.ai_lead_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('contact','company','deal','erp_customer')),
  subject_id uuid NOT NULL,
  score numeric NOT NULL CHECK (score >= 0 AND score <= 100),
  tier text CHECK (tier IN ('hot','warm','cold')),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, subject_type, subject_id)
);
CREATE INDEX IF NOT EXISTS ai_lead_scores_org_score_idx
  ON public.ai_lead_scores(organization_id, score DESC);
CREATE INDEX IF NOT EXISTS ai_lead_scores_expires_idx
  ON public.ai_lead_scores(expires_at);

GRANT SELECT ON public.ai_lead_scores TO authenticated;
GRANT ALL ON public.ai_lead_scores TO service_role;
ALTER TABLE public.ai_lead_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_lead_scores read members" ON public.ai_lead_scores
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "ai_lead_scores service manage" ON public.ai_lead_scores
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ai_lead_scores_touch BEFORE UPDATE ON public.ai_lead_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Churn predictions (por cliente ERP)
CREATE TABLE IF NOT EXISTS public.ai_churn_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  erp_customer_id uuid NOT NULL REFERENCES public.erp_customers(id) ON DELETE CASCADE,
  churn_probability numeric NOT NULL CHECK (churn_probability >= 0 AND churn_probability <= 1),
  risk_level text NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
  drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  suggested_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '14 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, erp_customer_id)
);
CREATE INDEX IF NOT EXISTS ai_churn_org_risk_idx
  ON public.ai_churn_predictions(organization_id, risk_level, churn_probability DESC);
CREATE INDEX IF NOT EXISTS ai_churn_expires_idx ON public.ai_churn_predictions(expires_at);

GRANT SELECT ON public.ai_churn_predictions TO authenticated;
GRANT ALL ON public.ai_churn_predictions TO service_role;
ALTER TABLE public.ai_churn_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_churn read members" ON public.ai_churn_predictions
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "ai_churn service manage" ON public.ai_churn_predictions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ai_churn_touch BEFORE UPDATE ON public.ai_churn_predictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Repurchase predictions
CREATE TABLE IF NOT EXISTS public.ai_repurchase_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  erp_customer_id uuid NOT NULL REFERENCES public.erp_customers(id) ON DELETE CASCADE,
  expected_purchase_at timestamptz,
  expected_value numeric,
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  suggested_skus jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '14 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, erp_customer_id)
);
CREATE INDEX IF NOT EXISTS ai_repurchase_org_date_idx
  ON public.ai_repurchase_predictions(organization_id, expected_purchase_at);
CREATE INDEX IF NOT EXISTS ai_repurchase_expires_idx
  ON public.ai_repurchase_predictions(expires_at);

GRANT SELECT ON public.ai_repurchase_predictions TO authenticated;
GRANT ALL ON public.ai_repurchase_predictions TO service_role;
ALTER TABLE public.ai_repurchase_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_repurchase read members" ON public.ai_repurchase_predictions
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "ai_repurchase service manage" ON public.ai_repurchase_predictions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ai_repurchase_touch BEFORE UPDATE ON public.ai_repurchase_predictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Generic recommendations
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('contact','company','deal','erp_customer','sales_rep')),
  subject_id uuid NOT NULL,
  recommendation_type text NOT NULL,
  title text NOT NULL,
  body text,
  priority int NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed','expired')),
  model text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + INTERVAL '7 days',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_recs_org_status_idx
  ON public.ai_recommendations(organization_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS ai_recs_subject_idx
  ON public.ai_recommendations(organization_id, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS ai_recs_expires_idx ON public.ai_recommendations(expires_at);

GRANT SELECT, UPDATE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_recs read members" ON public.ai_recommendations
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
-- members podem aceitar/descartar (apenas mudar status)
CREATE POLICY "ai_recs update status members" ON public.ai_recommendations
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "ai_recs service manage" ON public.ai_recommendations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ai_recs_touch BEFORE UPDATE ON public.ai_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- TTL cleanup function (called by daily cron)
CREATE OR REPLACE FUNCTION public.purge_expired_ai_artifacts()
RETURNS TABLE(table_name text, removed bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c1 bigint; c2 bigint; c3 bigint; c4 bigint;
BEGIN
  DELETE FROM public.ai_lead_scores WHERE expires_at < now(); GET DIAGNOSTICS c1 = ROW_COUNT;
  DELETE FROM public.ai_churn_predictions WHERE expires_at < now(); GET DIAGNOSTICS c2 = ROW_COUNT;
  DELETE FROM public.ai_repurchase_predictions WHERE expires_at < now(); GET DIAGNOSTICS c3 = ROW_COUNT;
  UPDATE public.ai_recommendations SET status = 'expired'
   WHERE status = 'pending' AND expires_at < now(); GET DIAGNOSTICS c4 = ROW_COUNT;
  RETURN QUERY VALUES
    ('ai_lead_scores'::text, c1),
    ('ai_churn_predictions'::text, c2),
    ('ai_repurchase_predictions'::text, c3),
    ('ai_recommendations_expired'::text, c4);
END $$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_ai_artifacts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_ai_artifacts() TO service_role;