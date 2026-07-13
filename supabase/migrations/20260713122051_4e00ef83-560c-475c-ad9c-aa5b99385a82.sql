DROP POLICY IF EXISTS "approvals_update_admin_or_requester" ON public.approvals;
CREATE POLICY "approvals_update_admin_or_requester" ON public.approvals
FOR UPDATE
USING (
  is_org_member(organization_id, auth.uid()) AND (
    has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role])
    OR (requester_id = auth.uid() AND status = 'pending')
  )
)
WITH CHECK (
  is_org_member(organization_id, auth.uid()) AND (
    has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role])
    OR (requester_id = auth.uid() AND status = 'pending')
  )
);

DROP POLICY IF EXISTS "expenses_update_owner_or_admin" ON public.expenses;
CREATE POLICY "expenses_update_owner_or_admin" ON public.expenses
FOR UPDATE
USING (
  is_org_member(organization_id, auth.uid()) AND (
    has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role])
    OR (user_id = auth.uid() AND status = 'pending')
  )
)
WITH CHECK (
  is_org_member(organization_id, auth.uid()) AND (
    has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role])
    OR (user_id = auth.uid() AND status = 'pending')
  )
);

DROP POLICY IF EXISTS "geo_route_plans_update_own" ON public.geo_route_plans;
CREATE POLICY "geo_route_plans_update_own" ON public.geo_route_plans
FOR UPDATE
USING (
  owner_user_id = auth.uid()
  OR has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role])
)
WITH CHECK (
  is_org_member(organization_id, auth.uid()) AND (
    owner_user_id = auth.uid()
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role])
  )
);