
DROP POLICY IF EXISTS ic_select ON public.integration_connections;
CREATE POLICY ic_select ON public.integration_connections
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin','manager']::org_role[]));

DROP POLICY IF EXISTS wa_channels_admin_select ON public.whatsapp_channels;
CREATE POLICY wa_channels_admin_select ON public.whatsapp_channels
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
