-- Inline updated_at helper (if not present)
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID,
  surface TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  priority SMALLINT NOT NULL DEFAULT 50,
  impact_brl NUMERIC,
  title TEXT NOT NULL,
  reason TEXT,
  action_label TEXT NOT NULL DEFAULT 'Executar',
  action_href TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  source TEXT NOT NULL DEFAULT 'heuristic',
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recs_org_surface ON public.recommendations(organization_id, surface, status, priority DESC);
CREATE INDEX idx_recs_user ON public.recommendations(organization_id, user_id, status, priority DESC);
CREATE INDEX idx_recs_entity ON public.recommendations(organization_id, entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recs_select_org" ON public.recommendations FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "recs_insert_org" ON public.recommendations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "recs_update_org" ON public.recommendations FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "recs_delete_org" ON public.recommendations FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_recs_updated BEFORE UPDATE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.business_health_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  score SMALLINT NOT NULL,
  pillars JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bhs_org ON public.business_health_scores(organization_id, computed_at DESC);

GRANT SELECT, INSERT ON public.business_health_scores TO authenticated;
GRANT ALL ON public.business_health_scores TO service_role;
ALTER TABLE public.business_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bhs_select_org" ON public.business_health_scores FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "bhs_insert_org" ON public.business_health_scores FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));