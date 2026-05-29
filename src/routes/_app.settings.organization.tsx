import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Shield, User, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/organization")({ component: OrgSettings });

const roleIcon = { owner: Crown, admin: Shield, member: User } as const;

function OrgSettings() {
  const { user } = useAuth();
  const { orgId, org, role, loading } = useCurrentOrg();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  useEffect(() => { if (org?.name) setName(org.name); }, [org?.name]);

  const canEdit = role === "owner" || role === "admin";

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ["org-members", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("id, user_id, role, created_at")
        .eq("organization_id", orgId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const rename = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Sem organização");
      const { error } = await supabase.from("organizations").update({ name: name.trim() }).eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Organização atualizada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const leave = useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase.from("memberships").delete().eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader title="Organização" subtitle={`Você é ${role === "owner" ? "owner" : role === "admin" ? "admin" : "membro"}`} />

      <Card className="mt-6 p-6">
        <h3 className="font-semibold">Detalhes</h3>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input value={org?.slug ?? ""} disabled />
          </div>
          {canEdit && (
            <Button onClick={() => rename.mutate()} disabled={rename.isPending || !name.trim() || name === org?.name}>
              Salvar
            </Button>
          )}
        </div>
      </Card>

      <Card className="mt-6 p-6">
        <h3 className="font-semibold">Membros</h3>
        <div className="mt-4 space-y-2">
          {loadingMembers && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          {members?.map((m) => {
            const Icon = roleIcon[m.role as keyof typeof roleIcon] ?? User;
            const isYou = m.user_id === user?.id;
            return (
              <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{isYou ? "Você" : m.user_id.slice(0, 8) + "…"}</p>
                    <Badge variant="secondary" className="mt-0.5 text-[10px]">{m.role}</Badge>
                  </div>
                </div>
                {isYou && m.role !== "owner" && (
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Sair desta organização?")) leave.mutate(m.id); }}>
                    <LogOut className="mr-1 h-4 w-4" /> Sair
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Convites por email chegam na próxima fase. Por ora, novos usuários criam a própria organização ao cadastrar.
        </p>
      </Card>
    </div>
  );
}
