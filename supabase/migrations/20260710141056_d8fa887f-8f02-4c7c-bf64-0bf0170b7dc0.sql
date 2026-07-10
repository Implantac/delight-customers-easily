
-- 1) Fix swapped args on ai_prediction_outcomes RLS
DROP POLICY IF EXISTS "tenant members read outcomes" ON public.ai_prediction_outcomes;
CREATE POLICY "tenant members read outcomes"
ON public.ai_prediction_outcomes
FOR SELECT
TO authenticated
USING (public.is_org_member(tenant_id, auth.uid()));

-- 2) Prevent privilege escalation via memberships self-insert
DROP POLICY IF EXISTS "memberships_insert_self_or_admin" ON public.memberships;

-- Allow existing owners/admins to add members to their org (any role)
CREATE POLICY "memberships_insert_admin"
ON public.memberships
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[])
);
-- Self-insert is intentionally NOT allowed by client policy.
-- Onboarding (handle_new_user) and invite acceptance (accept_org_invite) run as
-- SECURITY DEFINER and bypass RLS, so they continue to work.
