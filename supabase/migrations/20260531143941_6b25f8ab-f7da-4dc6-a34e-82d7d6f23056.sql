
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='realtime' AND c.relname='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "org_members_can_read_their_channels" ON realtime.messages';
    EXECUTE $POL$
      CREATE POLICY "org_members_can_read_their_channels" ON realtime.messages FOR SELECT TO authenticated
      USING (realtime.topic() LIKE 'org:%' AND public.is_org_member(substring(realtime.topic() FROM 5)::uuid, auth.uid()))
    $POL$;
    EXECUTE 'DROP POLICY IF EXISTS "org_members_can_send_to_their_channels" ON realtime.messages';
    EXECUTE $POL$
      CREATE POLICY "org_members_can_send_to_their_channels" ON realtime.messages FOR INSERT TO authenticated
      WITH CHECK (realtime.topic() LIKE 'org:%' AND public.is_org_member(substring(realtime.topic() FROM 5)::uuid, auth.uid()))
    $POL$;
  END IF;
END$$;

DROP POLICY IF EXISTS "webhooks_select" ON public.webhooks;

CREATE OR REPLACE VIEW public.webhooks_safe WITH (security_invoker = true) AS
SELECT id, organization_id, name, url, events, enabled, created_by, created_at, updated_at
FROM public.webhooks;
GRANT SELECT ON public.webhooks_safe TO authenticated;

DROP POLICY IF EXISTS "webhooks_select_admin_owner" ON public.webhooks;
CREATE POLICY "webhooks_select_admin_owner" ON public.webhooks FOR SELECT TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::public.org_role[]));

DROP POLICY IF EXISTS "attachments_update_org_members" ON storage.objects;
CREATE POLICY "attachments_update_org_members" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'attachments' AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()))
WITH CHECK (bucket_id = 'attachments' AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid()));
