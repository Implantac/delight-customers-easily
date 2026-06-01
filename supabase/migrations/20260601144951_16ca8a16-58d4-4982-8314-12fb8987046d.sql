-- Helper: pode ver tudo na org (owner/admin/manager)
CREATE OR REPLACE FUNCTION public.can_see_all_in_org(_org uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = _org
      AND user_id = _user
      AND role IN ('owner','admin','manager')
  );
$$;

-- DEALS: substituir política única
DROP POLICY IF EXISTS deals_org_access ON public.deals;

CREATE POLICY deals_select ON public.deals
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY deals_insert ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY deals_update ON public.deals
  FOR UPDATE TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  )
  WITH CHECK (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY deals_delete ON public.deals
  FOR DELETE TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

-- CONTACTS
DROP POLICY IF EXISTS contacts_org_access ON public.contacts;

CREATE POLICY contacts_select ON public.contacts
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY contacts_insert ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY contacts_update ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  )
  WITH CHECK (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY contacts_delete ON public.contacts
  FOR DELETE TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

-- COMPANIES
DROP POLICY IF EXISTS companies_org_access ON public.companies;

CREATE POLICY companies_select ON public.companies
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY companies_insert ON public.companies
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY companies_update ON public.companies
  FOR UPDATE TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  )
  WITH CHECK (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY companies_delete ON public.companies
  FOR DELETE TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

-- ACTIVITIES
DROP POLICY IF EXISTS activities_org_access ON public.activities;

CREATE POLICY activities_select ON public.activities
  FOR SELECT TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY activities_insert ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY activities_update ON public.activities
  FOR UPDATE TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  )
  WITH CHECK (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );

CREATE POLICY activities_delete ON public.activities
  FOR DELETE TO authenticated
  USING (
    is_org_member(organization_id, auth.uid())
    AND (can_see_all_in_org(organization_id, auth.uid()) OR user_id = auth.uid())
  );