CREATE TYPE public.routing_strategy AS ENUM ('round_robin','weighted','first_available','manual');

CREATE TABLE public.lead_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  strategy public.routing_strategy NOT NULL DEFAULT 'round_robin',
  priority int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  match_source text,
  match_territory_id uuid,
  match_min_value numeric,
  match_max_value numeric,
  match_tags text[],
  rr_cursor int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lead_routing_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  rule_id uuid NOT NULL REFERENCES public.lead_routing_rules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  weight int NOT NULL DEFAULT 1,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, user_id)
);

CREATE TABLE public.lead_routing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  rule_id uuid REFERENCES public.lead_routing_rules(id) ON DELETE SET NULL,
  lead_type text NOT NULL,
  lead_id uuid NOT NULL,
  assigned_to uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_routing_rules_org ON public.lead_routing_rules(organization_id, active, priority);
CREATE INDEX idx_routing_assignees_rule ON public.lead_routing_assignees(rule_id);
CREATE INDEX idx_routing_log_org ON public.lead_routing_log(organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_routing_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_routing_assignees TO authenticated;
GRANT SELECT, INSERT ON public.lead_routing_log TO authenticated;
GRANT ALL ON public.lead_routing_rules TO service_role;
GRANT ALL ON public.lead_routing_assignees TO service_role;
GRANT ALL ON public.lead_routing_log TO service_role;

ALTER TABLE public.lead_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_routing_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_routing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view routing rules" ON public.lead_routing_rules FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers manage routing rules" ON public.lead_routing_rules FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::public.org_role[]));

CREATE POLICY "members view routing assignees" ON public.lead_routing_assignees FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers manage routing assignees" ON public.lead_routing_assignees FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::public.org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::public.org_role[]));

CREATE POLICY "members view routing log" ON public.lead_routing_log FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert routing log" ON public.lead_routing_log FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER trg_routing_rules_updated BEFORE UPDATE ON public.lead_routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();