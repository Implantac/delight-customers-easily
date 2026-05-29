import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Membership = {
  organization_id: string;
  role: "owner" | "admin" | "member";
  organizations: { id: string; name: string; slug: string } | null;
};

export function useMemberships() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["memberships", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Membership[]> => {
      const { data, error } = await supabase
        .from("memberships")
        .select("organization_id, role, organizations(id, name, slug)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export function useCurrentOrg() {
  const { user } = useAuth();
  const memberships = useMemberships();

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, current_organization_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const currentId =
    profile.data?.current_organization_id ??
    memberships.data?.[0]?.organization_id ??
    null;

  const current =
    memberships.data?.find((m) => m.organization_id === currentId) ??
    memberships.data?.[0] ??
    null;

  return {
    orgId: current?.organization_id ?? null,
    role: current?.role ?? null,
    org: current?.organizations ?? null,
    memberships: memberships.data ?? [],
    loading: memberships.isLoading || profile.isLoading,
  };
}

export async function switchOrganization(userId: string, orgId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ current_organization_id: orgId })
    .eq("id", userId);
  if (error) throw error;
}
