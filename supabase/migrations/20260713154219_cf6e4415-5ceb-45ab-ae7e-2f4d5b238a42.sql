
-- dashboards: adiciona verificação de membresia
DROP POLICY IF EXISTS db_update ON public.dashboards;
CREATE POLICY db_update ON public.dashboards
FOR UPDATE
USING (
  is_org_member(organization_id, auth.uid())
  AND (
    owner_id = auth.uid()
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role])
  )
)
WITH CHECK (
  is_org_member(organization_id, auth.uid())
  AND (
    owner_id = auth.uid()
    OR has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role])
  )
);

-- saved_views: exige membresia na org
DROP POLICY IF EXISTS saved_views_update ON public.saved_views;
CREATE POLICY saved_views_update ON public.saved_views
FOR UPDATE
USING (
  user_id = auth.uid()
  AND is_org_member(organization_id, auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  AND is_org_member(organization_id, auth.uid())
);

-- ticket_comments: adiciona WITH CHECK + membresia
DROP POLICY IF EXISTS ticket_comments_update ON public.ticket_comments;
CREATE POLICY ticket_comments_update ON public.ticket_comments
FOR UPDATE
USING (
  author_id = auth.uid()
  AND is_org_member(organization_id, auth.uid())
)
WITH CHECK (
  author_id = auth.uid()
  AND is_org_member(organization_id, auth.uid())
);
