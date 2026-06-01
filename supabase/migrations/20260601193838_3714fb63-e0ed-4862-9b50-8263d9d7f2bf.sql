-- Restrict SELECT on tables with sensitive credentials to org admins/owners only
DROP POLICY IF EXISTS ic_select ON public.integration_connections;
CREATE POLICY ic_select ON public.integration_connections
  FOR SELECT
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role]));

DROP POLICY IF EXISTS wa_channels_member_select ON public.whatsapp_channels;
CREATE POLICY wa_channels_admin_select ON public.whatsapp_channels
  FOR SELECT
  USING (has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role]));