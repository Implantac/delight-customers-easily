import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Route as RouteIcon, Plus, Pencil, Trash2, Users, X, UserPlus, History } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  listRoutingRules, upsertRoutingRule, deleteRoutingRule,
} from "@/lib/routing.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/routing")({ component: RoutingPage });

const STRATEGY_LABEL: Record<string, string> = {
  round_robin: "Rodízio", weighted: "Ponderado",
  first_available: "Primeiro disponível", manual: "Manual",
};

function emptyDraft() {
  return {
    name: "",
    description: "",
    strategy: "round_robin" as const,
    priority: 100,
    active: true,
    match_source: "",
    match_territory_id: "",
    match_min_value: "",
    match_max_value: "",
    match_tags: "" as string,
    assignees: [] as { user_id: string; weight: number }[],
  };
}

function RoutingPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const fetchFn = useServerFn(listRoutingRules);
  const upsertFn = useServerFn(upsertRoutingRule);
  const delFn = useServerFn(deleteRoutingRule);

  const [editDlg, setEditDlg] = useState(false);
  const [draft, setDraft] = useState<any>(emptyDraft());

  const { data, isLoading } = useQuery({
    queryKey: ["routing", orgId],
    enabled: !!orgId,
    queryFn: () => fetchFn({ data: { organization_id: orgId! } }),
  });

  const { data: members } = useQuery({
    queryKey: ["org-members-routing", orgId],
    enabled: !!orgId && editDlg,
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("user_id, profiles:profiles!memberships_user_id_fkey(display_name, email)")
        .eq("organization_id", orgId!);
      return (data ?? []).map((m: any) => ({
        user_id: m.user_id,
        name: m.profiles?.display_name || m.profiles?.email || m.user_id.slice(0, 8),
      }));
    },
  });

  const { data: territories } = useQuery({
    queryKey: ["territories-min", orgId],
    enabled: !!orgId && editDlg,
    queryFn: async () => {
      const { data } = await supabase.from("territories").select("id, name").eq("organization_id", orgId!);
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: () => upsertFn({
      data: {
        id: draft.id,
        organization_id: orgId!,
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        strategy: draft.strategy,
        priority: Number(draft.priority) || 100,
        active: !!draft.active,
        match_source: draft.match_source?.trim() || null,
        match_territory_id: draft.match_territory_id || null,
        match_min_value: draft.match_min_value !== "" ? Number(draft.match_min_value) : null,
        match_max_value: draft.match_max_value !== "" ? Number(draft.match_max_value) : null,
        match_tags: draft.match_tags
          ? draft.match_tags.split(",").map((t: string) => t.trim()).filter(Boolean)
          : null,
        assignees: draft.assignees,
      },
    }),
    onSuccess: () => {
      toast.success("Regra salva");
      setEditDlg(false);
      qc.invalidateQueries({ queryKey: ["routing"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluída"); qc.invalidateQueries({ queryKey: ["routing"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setDraft(emptyDraft()); setEditDlg(true); };
  const openEdit = (r: any) => {
    setDraft({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      strategy: r.strategy,
      priority: r.priority,
      active: r.active,
      match_source: r.match_source ?? "",
      match_territory_id: r.match_territory_id ?? "",
      match_min_value: r.match_min_value ?? "",
      match_max_value: r.match_max_value ?? "",
      match_tags: (r.match_tags ?? []).join(", "),
      assignees: r.assignees.map((a: any) => ({ user_id: a.user_id, weight: a.weight })),
    });
    setEditDlg(true);
  };

  const memberName = (uid: string | null) =>
    (members ?? []).find((m) => m.user_id === uid)?.name ?? (uid ? uid.slice(0, 8) : "—");

  return (
    <div className="space-y-6">
      <PageHeader
        icon={RouteIcon}
        title="Roteamento de Leads"
        subtitle="Distribua leads automaticamente entre vendedores por regras e estratégias."
        action={canManage ? <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova regra</Button> : undefined}
      />

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Regras</TabsTrigger>
          <TabsTrigger value="log">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          {isLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : (data?.rules ?? []).length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <RouteIcon className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhuma regra de roteamento.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {(data?.rules ?? []).map((r: any) => (
                <Card key={r.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{r.name}</p>
                          <Badge variant={r.active ? "default" : "outline"} className="text-[10px]">
                            {r.active ? "Ativa" : "Inativa"}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">{STRATEGY_LABEL[r.strategy]}</Badge>
                          <Badge variant="outline" className="text-[10px]">Prioridade {r.priority}</Badge>
                        </div>
                        {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                        <div className="flex flex-wrap gap-1 mt-2 text-[11px] text-muted-foreground">
                          {r.match_source && <Badge variant="outline" className="text-[10px]">origem: {r.match_source}</Badge>}
                          {r.match_min_value !== null && <Badge variant="outline" className="text-[10px]">≥ {r.match_min_value}</Badge>}
                          {r.match_max_value !== null && <Badge variant="outline" className="text-[10px]">≤ {r.match_max_value}</Badge>}
                          {(r.match_tags ?? []).map((t: string) => (
                            <Badge key={t} variant="outline" className="text-[10px]">tag: {t}</Badge>
                          ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1 items-center text-xs">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {r.assignees.length === 0 ? (
                            <span className="text-muted-foreground">Sem destinatários</span>
                          ) : r.assignees.map((a: any) => (
                            <Badge key={a.user_id} variant="secondary" className="text-[10px]">
                              {memberName(a.user_id)} {r.strategy === "weighted" && `×${a.weight}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => { if (confirm("Excluir regra?")) remove.mutate(r.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <Card><CardContent className="p-0">
            {(data?.log ?? []).length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma atribuição registrada ainda.
              </div>
            ) : (
              <div className="divide-y">
                {(data?.log ?? []).map((l: any) => (
                  <div key={l.id} className="p-3 text-sm flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px]">{l.lead_type}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="truncate">
                        {l.assigned_to ? <>→ <span className="font-medium">{memberName(l.assigned_to)}</span></> : <span className="text-muted-foreground">não atribuído</span>}
                        {l.reason && <span className="text-muted-foreground ml-2">— {l.reason}</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono">{l.lead_id.slice(0, 8)}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editDlg} onOpenChange={setEditDlg}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar regra" : "Nova regra"}</DialogTitle>
            <DialogDescription>Critérios de match e estratégia de distribuição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
              <div>
                <Label>Nome</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <Label>Estratégia</Label>
                <Select value={draft.strategy} onValueChange={(v) => setDraft({ ...draft, strategy: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STRATEGY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridade</Label>
                <Input type="number" value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={draft.active} onCheckedChange={(c) => setDraft({ ...draft, active: c })} />
              <Label>Regra ativa</Label>
            </div>

            <div className="border rounded-md p-3 space-y-2">
              <Label className="text-xs uppercase tracking-wide">Critérios de match</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Origem</Label>
                  <Input placeholder="website, indicação..." value={draft.match_source}
                    onChange={(e) => setDraft({ ...draft, match_source: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Território</Label>
                  <Select value={draft.match_territory_id || "__none__"}
                    onValueChange={(v) => setDraft({ ...draft, match_territory_id: v === "__none__" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Qualquer —</SelectItem>
                      {(territories ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Valor mín</Label>
                  <Input type="number" value={draft.match_min_value}
                    onChange={(e) => setDraft({ ...draft, match_min_value: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Valor máx</Label>
                  <Input type="number" value={draft.match_max_value}
                    onChange={(e) => setDraft({ ...draft, match_max_value: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Tags (separadas por vírgula)</Label>
                  <Input value={draft.match_tags}
                    onChange={(e) => setDraft({ ...draft, match_tags: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Destinatários (ordem importa para rodízio)</Label>
              </div>
              <div className="space-y-2">
                {draft.assignees.map((a: any, i: number) => {
                  const m = (members ?? []).find((mm) => mm.user_id === a.user_id);
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant="secondary" className="flex-1">{m?.name ?? a.user_id.slice(0, 8)}</Badge>
                      {draft.strategy === "weighted" && (
                        <Input type="number" className="w-20" value={a.weight} min={1}
                          onChange={(e) => {
                            const ns = [...draft.assignees]; ns[i] = { ...ns[i], weight: Number(e.target.value) || 1 };
                            setDraft({ ...draft, assignees: ns });
                          }} />
                      )}
                      <Button size="sm" variant="ghost"
                        onClick={() => setDraft({ ...draft, assignees: draft.assignees.filter((_: any, j: number) => j !== i) })}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Select value=""
                onValueChange={(v) => {
                  if (!v || draft.assignees.find((a: any) => a.user_id === v)) return;
                  setDraft({ ...draft, assignees: [...draft.assignees, { user_id: v, weight: 1 }] });
                }}>
                <SelectTrigger>
                  <SelectValue placeholder="+ Adicionar membro" />
                </SelectTrigger>
                <SelectContent>
                  {(members ?? []).filter((m) => !draft.assignees.find((a: any) => a.user_id === m.user_id))
                    .map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDlg(false)}>Cancelar</Button>
            <Button disabled={!draft.name?.trim() || upsert.isPending} onClick={() => upsert.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
