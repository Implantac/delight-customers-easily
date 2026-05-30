import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardList, Plus, Pencil, Trash2, Play, CheckCircle2, Circle, Flag } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  listPlaybooks, upsertPlaybook, deletePlaybook,
  upsertPlaybookItem, deletePlaybookItem,
  listPlaybookRuns, startPlaybookRun, getPlaybookRun,
  toggleRunItem, finishPlaybookRun,
} from "@/lib/playbooks.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/playbooks")({ component: PlaybooksPage });

function PlaybooksPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const canManage = useCanManage();
  const listFn = useServerFn(listPlaybooks);
  const upPb = useServerFn(upsertPlaybook);
  const delPb = useServerFn(deletePlaybook);
  const upItem = useServerFn(upsertPlaybookItem);
  const delItem = useServerFn(deletePlaybookItem);
  const listRunsFn = useServerFn(listPlaybookRuns);
  const startFn = useServerFn(startPlaybookRun);
  const getRunFn = useServerFn(getPlaybookRun);
  const toggleFn = useServerFn(toggleRunItem);
  const finishFn = useServerFn(finishPlaybookRun);

  const [tab, setTab] = useState<"library" | "runs">("library");
  const [runStatus, setRunStatus] = useState<"all" | "active" | "completed" | "abandoned">("active");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pbDialog, setPbDialog] = useState(false);
  const [pbDraft, setPbDraft] = useState<any>({ name: "", description: "", stage: "", active: true });
  const [itemDraft, setItemDraft] = useState<any>({ title: "", description: "", position: 0, required: false });
  const [startDialog, setStartDialog] = useState(false);
  const [startDealId, setStartDealId] = useState<string>("");
  const [runDialogId, setRunDialogId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["playbooks", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });
  const { data: runsData } = useQuery({
    queryKey: ["playbook-runs", orgId, runStatus],
    queryFn: () => listRunsFn({ data: { organization_id: orgId!, status: runStatus } }),
    enabled: !!orgId && tab === "runs",
  });
  const { data: deals } = useQuery({
    queryKey: ["deals-min", orgId],
    enabled: !!orgId && startDialog,
    queryFn: async () => {
      const { data } = await supabase
        .from("deals").select("id, title").eq("organization_id", orgId!).order("updated_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const { data: runDetail } = useQuery({
    queryKey: ["playbook-run", runDialogId],
    enabled: !!runDialogId,
    queryFn: () => getRunFn({ data: { id: runDialogId! } }),
  });

  const activePb = useMemo(
    () => (data?.playbooks ?? []).find((p: any) => p.id === activeId) ?? null,
    [data, activeId],
  );
  const activeItems = useMemo(
    () => (data?.items ?? []).filter((it: any) => it.playbook_id === activeId),
    [data, activeId],
  );

  const savePb = useMutation({
    mutationFn: () =>
      upPb({
        data: {
          id: pbDraft.id, organization_id: orgId!,
          name: pbDraft.name.trim(),
          description: pbDraft.description?.trim() || null,
          stage: pbDraft.stage?.trim() || null,
          active: pbDraft.active,
        },
      }),
    onSuccess: () => { toast.success("Salvo"); setPbDialog(false); qc.invalidateQueries({ queryKey: ["playbooks"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const removePb = useMutation({
    mutationFn: (id: string) => delPb({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); setActiveId(null); qc.invalidateQueries({ queryKey: ["playbooks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: () =>
      upItem({
        data: {
          organization_id: orgId!, playbook_id: activeId!,
          title: itemDraft.title.trim(),
          description: itemDraft.description?.trim() || null,
          position: Number(itemDraft.position) || activeItems.length,
          required: itemDraft.required,
        },
      }),
    onSuccess: () => {
      setItemDraft({ title: "", description: "", position: 0, required: false });
      qc.invalidateQueries({ queryKey: ["playbooks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const removeItem = useMutation({
    mutationFn: (id: string) => delItem({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playbooks"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const startRun = useMutation({
    mutationFn: () =>
      startFn({
        data: {
          organization_id: orgId!,
          playbook_id: activeId!,
          deal_id: startDealId || null,
        },
      }),
    onSuccess: (run: any) => {
      toast.success("Execução iniciada");
      setStartDialog(false);
      setStartDealId("");
      setTab("runs");
      setRunDialogId(run.id);
      qc.invalidateQueries({ queryKey: ["playbook-runs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; completed: boolean }) => toggleFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["playbook-run", runDialogId] });
      qc.invalidateQueries({ queryKey: ["playbook-runs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const finish = useMutation({
    mutationFn: (v: { id: string; status: "completed" | "abandoned" }) => finishFn({ data: v }),
    onSuccess: () => {
      toast.success("Atualizado");
      setRunDialogId(null);
      qc.invalidateQueries({ queryKey: ["playbook-runs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNewPb = () => { setPbDraft({ name: "", description: "", stage: "", active: true }); setPbDialog(true); };
  const openEditPb = (p: any) => {
    setPbDraft({ id: p.id, name: p.name, description: p.description ?? "", stage: p.stage ?? "", active: p.active });
    setPbDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> Playbooks
          </h1>
          <p className="text-sm text-muted-foreground">Checklists padronizados para cada etapa do funil.</p>
        </div>
        {tab === "library" && canManage && (
          <Button onClick={openNewPb}><Plus className="h-4 w-4 mr-1" /> Novo playbook</Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="library">Biblioteca</TabsTrigger>
          <TabsTrigger value="runs">Execuções</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "library" ? (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card>
            <CardHeader><CardTitle className="text-sm">Playbooks</CardTitle></CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-3 space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (data?.playbooks ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground text-center">Nenhum playbook.</p>
              ) : (
                <div className="divide-y">
                  {(data?.playbooks ?? []).map((p: any) => {
                    const c = (data?.items ?? []).filter((it: any) => it.playbook_id === p.id).length;
                    return (
                      <button key={p.id} onClick={() => setActiveId(p.id)}
                        className={`w-full text-left p-3 hover:bg-accent/50 ${activeId === p.id ? "bg-accent/70" : ""}`}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate flex-1">{p.name}</span>
                          {!p.active && <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {c} item{c !== 1 && "s"}{p.stage && ` · ${p.stage}`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {activePb ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle>{activePb.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => setStartDialog(true)}><Play className="h-4 w-4 mr-1" /> Executar</Button>
                    {canManage && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openEditPb(activePb)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => { if (confirm("Excluir playbook?")) removePb.mutate(activePb.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {activePb.description && <p className="text-sm text-muted-foreground">{activePb.description}</p>}
                  {activePb.stage && <Badge variant="outline" className="text-[10px] mt-2">Etapa: {activePb.stage}</Badge>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Itens do checklist</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {canManage && (
                    <div className="grid grid-cols-[1fr_80px_auto_auto] gap-2 items-end">
                      <div>
                        <Label className="text-xs">Título</Label>
                        <Input value={itemDraft.title} onChange={(e) => setItemDraft({ ...itemDraft, title: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Pos.</Label>
                        <Input type="number" value={itemDraft.position} onChange={(e) => setItemDraft({ ...itemDraft, position: e.target.value })} />
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Switch checked={itemDraft.required} onCheckedChange={(v) => setItemDraft({ ...itemDraft, required: v })} />
                        <Label className="text-xs">Obrigatório</Label>
                      </div>
                      <Button onClick={() => addItem.mutate()} disabled={!itemDraft.title.trim() || addItem.isPending}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {activeItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Sem itens.</p>
                  ) : (
                    <div className="space-y-1">
                      {activeItems.map((it: any) => (
                        <div key={it.id} className="flex items-center gap-2 p-2 border rounded text-sm">
                          <Badge variant="outline" className="text-[10px]">#{it.position}</Badge>
                          {it.required && <Flag className="h-3 w-3 text-destructive" />}
                          <span className="flex-1 truncate">{it.title}</span>
                          {canManage && (
                            <Button size="sm" variant="ghost" onClick={() => removeItem.mutate(it.id)}>
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
                <ClipboardList className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">Selecione ou crie um playbook.</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Tabs value={runStatus} onValueChange={(v) => setRunStatus(v as any)}>
            <TabsList>
              <TabsTrigger value="active">Em andamento</TabsTrigger>
              <TabsTrigger value="completed">Concluídas</TabsTrigger>
              <TabsTrigger value="abandoned">Abandonadas</TabsTrigger>
              <TabsTrigger value="all">Todas</TabsTrigger>
            </TabsList>
          </Tabs>
          {(runsData?.runs ?? []).length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma execução.</CardContent></Card>
          ) : (
            <Card><CardContent className="p-0"><div className="divide-y">
              {(runsData?.runs ?? []).map((r: any) => {
                const p = runsData!.progress[r.id] ?? { total: 0, done: 0 };
                const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
                return (
                  <button key={r.id} onClick={() => setRunDialogId(r.id)}
                    className="w-full text-left p-3 hover:bg-accent/30">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{r.playbooks?.name ?? "—"}</span>
                      <Badge variant={r.status === "completed" ? "default" : r.status === "abandoned" ? "secondary" : "outline"} className="text-[10px]">
                        {r.status}
                      </Badge>
                      {r.deals?.title && <span className="text-xs text-muted-foreground">· {r.deals.title}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={pct} className="flex-1 h-1.5" />
                      <span className="text-[11px] text-muted-foreground">{p.done}/{p.total}</span>
                    </div>
                  </button>
                );
              })}
            </div></CardContent></Card>
          )}
        </div>
      )}

      <Dialog open={pbDialog} onOpenChange={setPbDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{pbDraft.id ? "Editar playbook" : "Novo playbook"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={pbDraft.name} onChange={(e) => setPbDraft({ ...pbDraft, name: e.target.value })} /></div>
            <div><Label>Etapa do funil (opcional)</Label><Input value={pbDraft.stage} onChange={(e) => setPbDraft({ ...pbDraft, stage: e.target.value })} placeholder="ex: Qualificação" /></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={pbDraft.description} onChange={(e) => setPbDraft({ ...pbDraft, description: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={pbDraft.active} onCheckedChange={(v) => setPbDraft({ ...pbDraft, active: v })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPbDialog(false)}>Cancelar</Button>
            <Button disabled={!pbDraft.name?.trim() || savePb.isPending} onClick={() => savePb.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={startDialog} onOpenChange={setStartDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Executar playbook: {activePb?.name}</DialogTitle></DialogHeader>
          <div>
            <Label>Deal (opcional)</Label>
            <Select value={startDealId || "__none__"} onValueChange={(v) => setStartDealId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sem deal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhum —</SelectItem>
                {(deals ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartDialog(false)}>Cancelar</Button>
            <Button disabled={startRun.isPending} onClick={() => startRun.mutate()}>Iniciar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!runDialogId} onOpenChange={(o) => !o && setRunDialogId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{runDetail?.run?.playbooks?.name ?? "Execução"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {(runDetail?.items ?? []).map((ri: any) => (
              <div key={ri.id} className="flex items-start gap-3 p-3 border rounded">
                <button onClick={() => toggle.mutate({ id: ri.id, completed: !ri.completed })} className="mt-0.5">
                  {ri.completed
                    ? <CheckCircle2 className="h-5 w-5 text-primary" />
                    : <Circle className="h-5 w-5 text-muted-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${ri.completed ? "line-through text-muted-foreground" : ""}`}>
                      {ri.playbook_items?.title}
                    </p>
                    {ri.playbook_items?.required && <Flag className="h-3 w-3 text-destructive" />}
                  </div>
                  {ri.playbook_items?.description && (
                    <p className="text-xs text-muted-foreground mt-1">{ri.playbook_items.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            {runDetail?.run?.status === "active" && (
              <>
                <Button variant="outline" onClick={() => finish.mutate({ id: runDialogId!, status: "abandoned" })}>Abandonar</Button>
                <Button onClick={() => finish.mutate({ id: runDialogId!, status: "completed" })}>Concluir</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
