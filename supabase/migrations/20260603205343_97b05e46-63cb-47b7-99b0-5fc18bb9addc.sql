
-- Fix 1: Restrict integration_connections SELECT to owner/admin only
DROP POLICY IF EXISTS ic_select ON public.integration_connections;
CREATE POLICY ic_select ON public.integration_connections
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

-- Fix 2: Restrict erp_local_agents SELECT to owner/admin only (pairing_code protection)
DROP POLICY IF EXISTS "members read agents" ON public.erp_local_agents;
CREATE POLICY "admins read agents" ON public.erp_local_agents
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));
