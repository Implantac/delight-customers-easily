
-- ============== ATTACHMENTS ==============
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact','company','deal')),
  entity_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY attachments_org_access ON public.attachments
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX idx_attachments_entity ON public.attachments(organization_id, entity_type, entity_id);

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage RLS: paths are scoped as `<org_id>/<entity>/<entity_id>/<filename>`
CREATE POLICY "attachments_org_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attachments' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
CREATE POLICY "attachments_org_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attachments' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));
CREATE POLICY "attachments_org_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'attachments' AND public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid()));

-- ============== DEAL AUDIT LOG ==============
CREATE TABLE public.deal_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  deal_id UUID NOT NULL,
  user_id UUID,
  event_type TEXT NOT NULL,
  from_value JSONB,
  to_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.deal_events TO authenticated;
GRANT ALL ON public.deal_events TO service_role;
ALTER TABLE public.deal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_events_org_select ON public.deal_events FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY deal_events_org_insert ON public.deal_events FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX idx_deal_events_deal ON public.deal_events(deal_id, created_at DESC);

-- Trigger: log stage and value changes
CREATE OR REPLACE FUNCTION public.log_deal_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.deal_events (organization_id, deal_id, user_id, event_type, to_value)
    VALUES (NEW.organization_id, NEW.id, auth.uid(), 'created',
      jsonb_build_object('title', NEW.title, 'stage', NEW.stage, 'value', NEW.value));
    RETURN NEW;
  END IF;
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.deal_events (organization_id, deal_id, user_id, event_type, from_value, to_value)
    VALUES (NEW.organization_id, NEW.id, auth.uid(), 'stage_changed',
      jsonb_build_object('stage', OLD.stage), jsonb_build_object('stage', NEW.stage));
  END IF;
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.deal_events (organization_id, deal_id, user_id, event_type, from_value, to_value)
    VALUES (NEW.organization_id, NEW.id, auth.uid(), 'value_changed',
      jsonb_build_object('value', OLD.value), jsonb_build_object('value', NEW.value));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_deal_insert AFTER INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_change();
CREATE TRIGGER trg_deal_update AFTER UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_change();

-- ============== TAGS ==============
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'slate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_org_access ON public.tags FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE public.taggings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contact','company','deal')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tag_id, entity_type, entity_id)
);
GRANT SELECT, INSERT, DELETE ON public.taggings TO authenticated;
GRANT ALL ON public.taggings TO service_role;
ALTER TABLE public.taggings ENABLE ROW LEVEL SECURITY;
CREATE POLICY taggings_org_access ON public.taggings FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX idx_taggings_entity ON public.taggings(organization_id, entity_type, entity_id);
