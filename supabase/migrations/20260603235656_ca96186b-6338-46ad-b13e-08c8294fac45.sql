-- Ensure ALL internal functions are restricted
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deals_set_closed_at() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_org_hierarchy() FROM public, anon, authenticated;

-- Grant to appropriate roles
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, org_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tg_set_updated_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deals_set_closed_at() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_org_hierarchy() TO authenticated, service_role;

-- Re-apply RLS fixes that might have been affected by revoking from 'public' (since authenticated inherits from public)
ALTER FUNCTION public.has_org_role(uuid, uuid, org_role[]) SECURITY DEFINER;
ALTER FUNCTION public.is_org_member(uuid, uuid) SECURITY DEFINER;
