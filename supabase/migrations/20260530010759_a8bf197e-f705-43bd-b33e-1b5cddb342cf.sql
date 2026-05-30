CREATE TABLE public.playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  stage TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_playbooks_org ON public.playbooks(organization_id);

CREATE TABLE public.playbook_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_playbook_items_pb ON public.playbook_items(playbook_id);

CREATE TABLE public.playbook_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  playbook_id UUID NOT NULL REFERENCES public.playbooks(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  started_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_playbook_runs_org ON public.playbook_runs(organization_id);
CREATE INDEX idx_playbook_runs_deal ON public.playbook_runs(deal_id);

CREATE TABLE public.playbook_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.playbook_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.playbook_items(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  note TEXT,
  UNIQUE (run_id, item_id)
);
CREATE INDEX idx_playbook_run_items_run ON public.playbook_run_items(run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.playbooks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playbook_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playbook_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playbook_run_items TO authenticated;
GRANT ALL ON public.playbooks TO service_role;
GRANT ALL ON public.playbook_items TO service_role;
GRANT ALL ON public.playbook_runs TO service_role;
GRANT ALL ON public.playbook_run_items TO service_role;

ALTER TABLE public.playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playbooks_select_member" ON public.playbooks FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "playbooks_write_admin" ON public.playbooks FOR ALL TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE POLICY "playbook_items_select_member" ON public.playbook_items FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "playbook_items_write_admin" ON public.playbook_items FOR ALL TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE POLICY "playbook_runs_select_member" ON public.playbook_runs FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "playbook_runs_insert_member" ON public.playbook_runs FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND started_by = auth.uid());
CREATE POLICY "playbook_runs_update_member" ON public.playbook_runs FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "playbook_runs_delete_admin" ON public.playbook_runs FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE POLICY "playbook_run_items_select_member" ON public.playbook_run_items FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "playbook_run_items_write_member" ON public.playbook_run_items FOR ALL TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER playbooks_set_updated_at BEFORE UPDATE ON public.playbooks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();