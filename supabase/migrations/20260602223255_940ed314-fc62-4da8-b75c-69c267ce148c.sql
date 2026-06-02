
CREATE TABLE public.briefing_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'app' CHECK (channel IN ('app','whatsapp','both')),
  send_time TIME NOT NULL DEFAULT '07:30',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  whatsapp_phone TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX briefing_preferences_org_idx ON public.briefing_preferences(organization_id);
CREATE INDEX briefing_preferences_enabled_idx ON public.briefing_preferences(enabled) WHERE enabled = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefing_preferences TO authenticated;
GRANT ALL ON public.briefing_preferences TO service_role;

ALTER TABLE public.briefing_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "briefing_prefs_select_own"
  ON public.briefing_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "briefing_prefs_insert_own"
  ON public.briefing_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_org_member(organization_id, auth.uid()));

CREATE POLICY "briefing_prefs_update_own"
  ON public.briefing_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "briefing_prefs_delete_own"
  ON public.briefing_preferences FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER briefing_preferences_set_updated_at
  BEFORE UPDATE ON public.briefing_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.commercial_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'no_purchase_days',
    'churn_risk_high',
    'high_potential_no_visit',
    'birthday',
    'new_lead_no_contact'
  )),
  threshold INTEGER,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_matched INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX commercial_automations_org_idx ON public.commercial_automations(organization_id);
CREATE INDEX commercial_automations_enabled_idx ON public.commercial_automations(enabled) WHERE enabled = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_automations TO authenticated;
GRANT ALL ON public.commercial_automations TO service_role;

ALTER TABLE public.commercial_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_automations_select_member"
  ON public.commercial_automations FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));

CREATE POLICY "commercial_automations_insert_admin"
  ON public.commercial_automations FOR INSERT TO authenticated
  WITH CHECK (has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role]));

CREATE POLICY "commercial_automations_update_admin"
  ON public.commercial_automations FOR UPDATE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role]));

CREATE POLICY "commercial_automations_delete_admin"
  ON public.commercial_automations FOR DELETE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role]));

CREATE TRIGGER commercial_automations_set_updated_at
  BEFORE UPDATE ON public.commercial_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
