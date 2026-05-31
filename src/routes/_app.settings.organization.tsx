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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Shield, User, LogOut, Copy, Trash2, Mail, Building2 } from "lucide-react";
import { toast } from "sonner";
import { inviteSchema } from "@/lib/validation";

export const Route = createFileRoute("/_app/settings/organization")({ component: OrgSettings });

const roleIcon = { owner: Crown, admin: Shield, member: User } as const;

function OrgSettings() {
  const { user } = useAuth();
  const { orgId, org, role, loading } = useCurrentOrg();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

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

  const { data: invites, isLoading: loadingInvites } = useQuery({
    queryKey: ["org-invites", orgId],
    enabled: !!orgId && canEdit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("org_invites")
        .select("id, email, role, token, accepted_at, expires_at, created_at")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
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

  const invite = useMutation({
    mutationFn: async () => {
      if (!orgId || !user) throw new Error("Sem organização");
      const parsed = inviteSchema.parse({ email: inviteEmail, role: inviteRole });
      const { error } = await supabase.from("org_invites").insert({
        organization_id: orgId,
        email: parsed.email,
        role: parsed.role,
        invited_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-invites", orgId] });
      setInviteEmail("");
      toast.success("Convite criado. Copie o link e envie ao destinatário.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("org_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["org-invites", orgId] }); toast.success("Convite removido"); },
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  if (loading) {
    return <div className="p-4 md:p-8 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <PageHeader icon={Building2} title="Organização" subtitle={`Você é ${role === "owner" ? "owner" : role === "admin" ? "admin" : "membro"} — gerencie membros, papéis e convites.`} />

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
      </Card>

      {canEdit && (
        <Card className="mt-6 p-6">
          <h3 className="font-semibold">Convites</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Crie um convite e envie o link ao destinatário. Ele precisa entrar com o mesmo email para aceitar.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="email@exemplo.com"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              maxLength={255}
              className="flex-1"
            />
            <Select value={inviteRole} onValueChange={(v: "admin" | "member") => setInviteRole(v)}>
              <SelectTrigger className="sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Membro</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => invite.mutate()} disabled={invite.isPending || !inviteEmail}>
              <Mail className="mr-1 h-4 w-4" /> Convidar
            </Button>
          </div>

          <div className="mt-5 space-y-2">
            {loadingInvites && <Skeleton className="h-12 w-full" />}
            {invites?.length === 0 && !loadingInvites && (
              <p className="text-xs text-muted-foreground">Nenhum convite pendente.</p>
            )}
            {invites?.map((i) => {
              const expired = new Date(i.expires_at) < new Date();
              const accepted = !!i.accepted_at;
              return (
                <div key={i.id} className="flex items-center justify-between gap-2 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.email}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">{i.role}</Badge>
                      {accepted ? (
                        <Badge className="text-[10px]">Aceito</Badge>
                      ) : expired ? (
                        <Badge variant="destructive" className="text-[10px]">Expirado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {!accepted && !expired && (
                      <Button variant="ghost" size="sm" onClick={() => copyLink(i.token)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover convite?")) revoke.mutate(i.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
