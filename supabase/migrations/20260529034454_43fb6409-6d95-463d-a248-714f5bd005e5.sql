-- Saved views (filtros salvos por usuário/org)
CREATE TABLE public.saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  entity text NOT NULL CHECK (entity IN ('contacts','companies','deals','activities')),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_views TO authenticated;
GRANT ALL ON public.saved_views TO service_role;

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_views_select ON public.saved_views FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid())
       AND (is_shared OR user_id = auth.uid()));

CREATE POLICY saved_views_insert ON public.saved_views FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY saved_views_update ON public.saved_views FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY saved_views_delete ON public.saved_views FOR DELETE TO authenticated
USING (user_id = auth.uid()
       OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE TRIGGER saved_views_updated_at BEFORE UPDATE ON public.saved_views
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_saved_views_org_entity ON public.saved_views(organization_id, entity);

-- Audit log genérico (substitui/expande deal_events para todas as entidades)
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created','updated','deleted')),
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY audit_log_insert ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_audit_log_entity ON public.audit_log(organization_id, entity_type, entity_id, created_at DESC);

-- Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.log_entity_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_changes jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org := OLD.organization_id;
    INSERT INTO public.audit_log (organization_id, user_id, entity_type, entity_id, action, changes)
    VALUES (v_org, auth.uid(), TG_TABLE_NAME, OLD.id, 'deleted', to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    v_org := NEW.organization_id;
    INSERT INTO public.audit_log (organization_id, user_id, entity_type, entity_id, action, changes)
    VALUES (v_org, auth.uid(), TG_TABLE_NAME, NEW.id, 'created', to_jsonb(NEW));
    RETURN NEW;
  ELSE
    v_org := NEW.organization_id;
    SELECT jsonb_object_agg(key, jsonb_build_object('from', old_val, 'to', new_val))
      INTO v_changes
    FROM (
      SELECT key, to_jsonb(OLD)->key AS old_val, to_jsonb(NEW)->key AS new_val
      FROM jsonb_object_keys(to_jsonb(NEW)) AS key
      WHERE to_jsonb(OLD)->key IS DISTINCT FROM to_jsonb(NEW)->key
        AND key NOT IN ('updated_at','created_at')
    ) diffs;
    IF v_changes IS NOT NULL THEN
      INSERT INTO public.audit_log (organization_id, user_id, entity_type, entity_id, action, changes)
      VALUES (v_org, auth.uid(), TG_TABLE_NAME, NEW.id, 'updated', v_changes);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER audit_contacts AFTER INSERT OR UPDATE OR DELETE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.log_entity_change();

CREATE TRIGGER audit_companies AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.log_entity_change();

CREATE TRIGGER audit_activities AFTER INSERT OR UPDATE OR DELETE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.log_entity_change();