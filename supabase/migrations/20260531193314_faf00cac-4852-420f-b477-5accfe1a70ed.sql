
CREATE TABLE public.dashboards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_shared boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboards TO authenticated;
GRANT ALL ON public.dashboards TO service_role;

ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY db_select ON public.dashboards FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND (is_shared OR owner_id = auth.uid()));
CREATE POLICY db_insert ON public.dashboards FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND owner_id = auth.uid());
CREATE POLICY db_update ON public.dashboards FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE POLICY db_delete ON public.dashboards FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER trg_db_updated_at BEFORE UPDATE ON public.dashboards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.dashboard_widgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id uuid NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  widget_type text NOT NULL CHECK (widget_type IN ('kpi_won_month','kpi_pipeline_open','kpi_deals_count','bar_by_stage','line_revenue_6m','funnel_conversion','top_reps','goal_progress','recent_activities')),
  title text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_widgets TO authenticated;
GRANT ALL ON public.dashboard_widgets TO service_role;

ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY dw_select ON public.dashboard_widgets FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY dw_modify ON public.dashboard_widgets FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dashboards d
    WHERE d.id = dashboard_id
      AND (d.owner_id = auth.uid() OR public.has_org_role(d.organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dashboards d
    WHERE d.id = dashboard_id
      AND (d.owner_id = auth.uid() OR public.has_org_role(d.organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  ));

CREATE INDEX idx_dw_dashboard ON public.dashboard_widgets(dashboard_id, sort_order);
