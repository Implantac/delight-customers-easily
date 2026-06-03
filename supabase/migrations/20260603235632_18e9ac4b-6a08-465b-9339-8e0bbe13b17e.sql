-- 1. SECURITY: Revoke public execution on internal SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) FROM public;
REVOKE ALL ON FUNCTION public.is_org_member(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.tg_set_updated_at() FROM public;
REVOKE ALL ON FUNCTION public.deals_set_closed_at() FROM public;
REVOKE ALL ON FUNCTION public.validate_org_hierarchy() FROM public;

GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tg_set_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deals_set_closed_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_org_hierarchy() TO authenticated, service_role;

-- 2. OPTIMIZATION: Critical Indexes for Foreign Keys (avoid Full Table Scans in RLS and Joins)
CREATE INDEX IF NOT EXISTS idx_memberships_org_user ON public.memberships(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_current_org ON public.profiles(current_organization_id);

CREATE INDEX IF NOT EXISTS idx_deals_org_id ON public.deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON public.deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON public.deals(company_id);

CREATE INDEX IF NOT EXISTS idx_activities_org_id ON public.activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON public.activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON public.activities(contact_id);

CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON public.contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_companies_org_id ON public.companies(organization_id);

CREATE INDEX IF NOT EXISTS idx_ai_copilot_messages_thread ON public.ai_copilot_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_copilot_threads_org ON public.ai_copilot_threads(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_copilot_threads_user ON public.ai_copilot_threads(user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_org ON public.whatsapp_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conv ON public.whatsapp_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON public.notifications(organization_id);

-- 3. SECURITY: Strengthen Multi-tenant RLS (Fixing potential leaks)

-- Ensure organizations can only be updated by admins/owners
DROP POLICY IF EXISTS "orgs_update_admin" ON public.organizations;
CREATE POLICY "orgs_update_admin" ON public.organizations
FOR UPDATE TO authenticated
USING (has_org_role(id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role]))
WITH CHECK (has_org_role(id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role]));

-- Ensure users can only see their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

-- 4. CONSTRAINTS: Ensure data integrity
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_org_user_unique;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_org_user_unique UNIQUE (organization_id, user_id);

ALTER TABLE public.organizations ALTER COLUMN created_by SET DEFAULT auth.uid();
