import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Map as MapIcon, Plus, Pencil, Trash2, UserPlus, Filter } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  listTerritories, upsertTerritory, deleteTerritory,
  addTerritoryRule, deleteTerritoryRule,
  addTerritoryMember, removeTerritoryMember,
} from "@/lib/territories.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/territories")({ component: TerritoriesPage });

const FIELD_LABEL: Record<string, string> = {
  country: "País", state: "Estado", city: "Cidade", industry: "Setor",
  revenue_min: "Receita ≥", revenue_max: "Receita ≤", tag: "Tag",
};
const OP_LABEL: Record<string, string> = {
  equals: "=", contains: "contém", gte: "≥", lte: "≤", in: "em",
};

function emptyDraft() {
  return { name: "", description: "", color: "#6366f1", default_owner_id: null as string | null, active: true };
}

function TerritoriesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const canManage = useCanManage();
  const fetchFn = useServerFn(listTerritories);
  const upsertFn = useServerFn(upsertTerritory);
  const delFn = useServerFn(deleteTerritory);
  const addRuleFn = useServerFn(addTerritoryRule);
  const delRuleFn = useServerFn(deleteTerritoryRule);
  const addMemberFn = useServerFn(addTerritoryMember);
  const delMemberFn = useServerFn(removeTerritoryMember);

  const [dialog, setDialog] = useState(false);
  const [draft, setDraft] = useState<any>({ ...emptyDraft() });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<any>({ field: "country", operator: "equals", value: "", priority: 0 });
  const [memberUserId, setMemberUserId] = useState<string>("");
  const [memberWeight, setMemberWeight] = useState<number>(1);

  const { data, isLoading } = useQuery({
    queryKey: ["territories", orgId],
    queryFn: () => fetchFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const { data: orgMembers } = useQuery({
    queryKey: ["org-members-min", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("user_id, profiles:profiles(id, full_name, email)")
        .eq("organization_id", orgId!);
      return data ?? [];
    },
  });

  const profileName = (uid: string | null) => {
    if (!uid) return "—";
    const m: any = (orgMembers ?? []).find((m: any) => m.user_id === uid);
    return m?.profiles?.full_name || m?.profiles?.email || uid.slice(0, 8);
  };

  const upsert = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: draft.id,
          organization_id: orgId!,
          name: draft.name.trim(),
          description: draft.description?.trim() || null,
          color: draft.color,
          default_owner_id: draft.default_owner_id,
          active: draft.active,
        },
      }),
    onSuccess: () => { toast.success("Salvo"); setDialog(false); qc.invalidateQueries({ queryKey: ["territories"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["territories"] }); setActiveId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const addRule = useMutation({
    mutationFn: () =>
      addRuleFn({
        data: {
          territory_id: activeId!,
          organization_id: orgId!,
          field: ruleDraft.field,
          operator: ruleDraft.operator,
          value: ruleDraft.value.trim(),
          priority: Number(ruleDraft.priority) || 0,
        },
      }),
    onSuccess: () => {
      toast.success("Regra adicionada");
      setRuleDraft({ field: "country", operator: "equals", value: "", priority: 0 });
      qc.invalidateQueries({ queryKey: ["territories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delRule = useMutation({
    mutationFn: (id: string) => delRuleFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["territories"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: () =>
      addMemberFn({
        data: {
          territory_id: activeId!,
          organization_id: orgId!,
          user_id: memberUserId,
          weight: Number(memberWeight) || 1,
        },
      }),
    onSuccess: () => {
      toast.success("Vendedor adicionado");
      setMemberUserId("");
      setMemberWeight(1);
      qc.invalidateQueries({ queryKey: ["territories"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMember = useMutation({
    mutationFn: (id: string) => delMemberFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["territories"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ ...emptyDraft() }); setDialog(true); };
  const openEdit = (t: any) => {
    setDraft({
      id: t.id, name: t.name, description: t.description ?? "",
      color: t.color ?? "#6366f1", default_owner_id: t.default_owner_id, active: t.active,
    });
    setDialog(true);
  };

  const activeTerritory = useMemo(
    () => (data?.territories ?? []).find((t) => t.id === activeId) ?? null,
    [data, activeId],
  );
  const activeRules = useMemo(
    () => (data?.rules ?? []).filter((r) => r.territory_id === activeId),
    [data, activeId],
  );
  const activeMembers = useMemo(
    () => (data?.members ?? []).filter((m) => m.territory_id === activeId),
    [data, activeId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MapIcon}
        title="Territórios"
        subtitle="Roteamento e distribuição de carteira por região ou segmento."
        action={canManage ? (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo território</Button>
        ) : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-sm">Territórios</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-3 space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (data?.territories ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">Nenhum território.</p>
            ) : (
              <div className="divide-y">
                {(data?.territories ?? []).map((t) => {
                  const rc = (data?.rules ?? []).filter((r) => r.territory_id === t.id).length;
                  const mc = (data?.members ?? []).filter((m) => m.territory_id === t.id).length;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveId(t.id)}
                      className={`w-full text-left p-3 hover:bg-accent/50 transition-colors ${activeId === t.id ? "bg-accent/70" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: t.color ?? "#6366f1" }} />
                        <span className="font-semibold text-sm truncate flex-1">{t.name}</span>
                        {!t.active && <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {rc} regra{rc !== 1 && "s"} · {mc} vendedor{mc !== 1 && "es"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {activeTerritory ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full" style={{ background: activeTerritory.color ?? "#6366f1" }} />
                  <CardTitle>{activeTerritory.name}</CardTitle>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(activeTerritory)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost"
                      onClick={() => { if (confirm("Excluir território?")) remove.mutate(activeTerritory.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {activeTerritory.description && (
                  <p className="text-sm text-muted-foreground">{activeTerritory.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Dono padrão: <span className="font-medium text-foreground">{profileName(activeTerritory.default_owner_id)}</span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" /> Regras de roteamento</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {canManage && (
                  <div className="grid grid-cols-[1fr_1fr_2fr_80px_auto] gap-2 items-end">
                    <div>
                      <Label className="text-xs">Campo</Label>
                      <Select value={ruleDraft.field} onValueChange={(v) => setRuleDraft({ ...ruleDraft, field: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(FIELD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Operador</Label>
                      <Select value={ruleDraft.operator} onValueChange={(v) => setRuleDraft({ ...ruleDraft, operator: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(OP_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Valor</Label>
                      <Input value={ruleDraft.value} onChange={(e) => setRuleDraft({ ...ruleDraft, value: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Prio.</Label>
                      <Input type="number" value={ruleDraft.priority} onChange={(e) => setRuleDraft({ ...ruleDraft, priority: e.target.value })} />
                    </div>
                    <Button onClick={() => addRule.mutate()} disabled={!ruleDraft.value.trim() || addRule.isPending}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {activeRules.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Nenhuma regra. Empresas/contatos não serão roteados automaticamente.</p>
                ) : (
                  <div className="space-y-1">
                    {activeRules.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 p-2 border rounded text-sm">
                        <Badge variant="outline" className="text-[10px]">prio {r.priority}</Badge>
                        <span className="font-medium">{FIELD_LABEL[r.field] ?? r.field}</span>
                        <span className="text-muted-foreground">{OP_LABEL[r.operator] ?? r.operator}</span>
                        <span className="flex-1 truncate font-mono text-xs">{r.value}</span>
                        {canManage && (
                          <Button size="sm" variant="ghost" onClick={() => delRule.mutate(r.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><UserPlus className="h-4 w-4" /> Vendedores do território</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {canManage && (
                  <div className="grid grid-cols-[1fr_80px_auto] gap-2 items-end">
                    <div>
                      <Label className="text-xs">Vendedor</Label>
                      <Select value={memberUserId} onValueChange={setMemberUserId}>
                        <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          {(orgMembers ?? [])
                            .filter((m: any) => !activeMembers.some((am) => am.user_id === m.user_id))
                            .map((m: any) => (
                              <SelectItem key={m.user_id} value={m.user_id}>
                                {m.profiles?.full_name || m.profiles?.email || m.user_id.slice(0, 8)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Peso</Label>
                      <Input type="number" min={1} value={memberWeight} onChange={(e) => setMemberWeight(Number(e.target.value))} />
                    </div>
                    <Button onClick={() => addMember.mutate()} disabled={!memberUserId || addMember.isPending}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {activeMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Nenhum vendedor associado.</p>
                ) : (
                  <div className="space-y-1">
                    {activeMembers.map((m) => (
                      <div key={m.id} className="flex items-center gap-2 p-2 border rounded text-sm">
                        <span className="flex-1">{profileName(m.user_id)}</span>
                        <Badge variant="outline" className="text-[10px]">peso {m.weight}</Badge>
                        {canManage && (
                          <Button size="sm" variant="ghost" onClick={() => delMember.mutate(m.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-center text-muted-foreground">
              <MapIcon className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Selecione um território para gerenciar regras e vendedores.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{draft.id ? "Editar território" : "Novo território"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Cor</Label>
                <Input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
              </div>
              <div>
                <Label>Dono padrão</Label>
                <Select
                  value={draft.default_owner_id ?? "__none__"}
                  onValueChange={(v) => setDraft({ ...draft, default_owner_id: v === "__none__" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhum —</SelectItem>
                    {(orgMembers ?? []).map((m: any) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profiles?.full_name || m.profiles?.email || m.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button disabled={!draft.name?.trim() || upsert.isPending} onClick={() => upsert.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
