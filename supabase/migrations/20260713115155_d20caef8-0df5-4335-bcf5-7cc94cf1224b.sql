
-- contracts
DROP POLICY IF EXISTS "owners update contracts" ON public.contracts;
CREATE POLICY "owners update contracts" ON public.contracts FOR UPDATE
USING (public.is_org_member(organization_id, auth.uid()) AND ((owner_id = auth.uid()) OR (created_by = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin'::org_role,'owner'::org_role])))
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND ((owner_id = auth.uid()) OR (created_by = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin'::org_role,'owner'::org_role])));

-- dashboards
DROP POLICY IF EXISTS "db_update" ON public.dashboards;
CREATE POLICY "db_update" ON public.dashboards FOR UPDATE
USING ((owner_id = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]))
WITH CHECK ((owner_id = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

-- kb_articles
DROP POLICY IF EXISTS "kb_articles_update" ON public.kb_articles;
CREATE POLICY "kb_articles_update" ON public.kb_articles FOR UPDATE
USING (public.is_org_member(organization_id, auth.uid()) AND ((author_id = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role])))
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND ((author_id = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role])));

-- memberships
DROP POLICY IF EXISTS "memberships_update_admin" ON public.memberships;
CREATE POLICY "memberships_update_admin" ON public.memberships FOR UPDATE
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

-- message_templates
DROP POLICY IF EXISTS "owners update templates" ON public.message_templates;
CREATE POLICY "owners update templates" ON public.message_templates FOR UPDATE
USING (public.is_org_member(organization_id, auth.uid()) AND ((created_by = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin'::org_role,'owner'::org_role])))
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND ((created_by = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin'::org_role,'owner'::org_role])));

-- proposals
DROP POLICY IF EXISTS "owners update proposals" ON public.proposals;
CREATE POLICY "owners update proposals" ON public.proposals FOR UPDATE
USING (public.is_org_member(organization_id, auth.uid()) AND ((created_by = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin'::org_role,'owner'::org_role])))
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND ((created_by = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin'::org_role,'owner'::org_role])));

-- tickets
DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
CREATE POLICY "tickets_update" ON public.tickets FOR UPDATE
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- time_entries
DROP POLICY IF EXISTS "time_entries_owner_update" ON public.time_entries;
CREATE POLICY "time_entries_owner_update" ON public.time_entries FOR UPDATE
USING (public.is_org_member(organization_id, auth.uid()) AND ((user_id = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin'::org_role,'owner'::org_role])))
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND ((user_id = auth.uid()) OR public.has_org_role(organization_id, auth.uid(), ARRAY['admin'::org_role,'owner'::org_role])));
