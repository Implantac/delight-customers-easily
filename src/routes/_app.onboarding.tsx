import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Rocket, Plus, Trash2, Pencil, Check, X, ListChecks, CalendarDays, Building2, BookOpen, Clock, FileText, LayoutDashboard, Share2 } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import {
  listOnboardingTemplates, upsertOnboardingTemplate, deleteOnboardingTemplate,
  listOnboardingProjects, createOnboardingProject, toggleProjectStep,
  updateProjectStatus, deleteOnboardingProject,
} from "@/lib/onboarding.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ProjectTimeline } from "@/components/onboarding/project-timeline";
import { PageHeader } from "@/components/page-header";
import { ErpSyncHealth } from "@/components/erp-sync-health";

export const Route = createFileRoute("/_app/onboarding")({ component: OnboardingPage });

const STATUS_LABEL: Record<string, string> = {
  not_started: "Não iniciado", in_progress: "Em andamento",
  completed: "Concluído", cancelled: "Cancelado",
};
const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  not_started: "outline", in_progress: "secondary",
  completed: "default", cancelled: "destructive",
};

function emptyTpl() {
  return {
    id: undefined as string | undefined,
    name: "", description: "",
    duration_days: 30,
    is_active: true,
    steps: [{ id: "0", title: "Kick-off", description: "" }] as any[],
  };
}
function emptyProj() {
  return {
    template_id: null as string | null,
    company_id: "" as string | "",
    name: "",
    started_at: new Date().toISOString().slice(0, 10),
    notes: "",
  };
}

function OnboardingPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const tplsFn = useServerFn(listOnboardingTemplates);
  const upsertTplFn = useServerFn(upsertOnboardingTemplate);
  const delTplFn = useServerFn(deleteOnboardingTemplate);
  const projsFn = useServerFn(listOnboardingProjects);
  const createProjFn = useServerFn(createOnboardingProject);
  const toggleFn = useServerFn(toggleProjectStep);
  const statusFn = useServerFn(updateProjectStatus);
  const delProjFn = useServerFn(deleteOnboardingProject);

  const [filter, setFilter] = useState<string>("all");
  const [tplDlg, setTplDlg] = useState(false);
  const [tplDraft, setTplDraft] = useState(emptyTpl());
  const [projDlg, setProjDlg] = useState(false);
  const [projDraft, setProjDraft] = useState(emptyProj());
  const [detail, setDetail] = useState<any>(null);

  const { data: tplsData } = useQuery({
    queryKey: ["onb-tpls", orgId], enabled: !!orgId,
    queryFn: () => tplsFn({ data: { organization_id: orgId! } }),
  });
  const { data: projsData, isLoading } = useQuery({
    queryKey: ["onb-projs", orgId, filter], enabled: !!orgId,
    queryFn: () => projsFn({ data: { organization_id: orgId!, status: filter } }),
  });

  const upsertTpl = useMutation({
    mutationFn: () => upsertTplFn({
      data: {
        id: tplDraft.id,
        organization_id: orgId!,
        name: tplDraft.name.trim(),
        description: tplDraft.description?.trim() || null,
        duration_days: Number(tplDraft.duration_days) || 30,
        is_active: tplDraft.is_active,
        steps: tplDraft.steps.filter((s: any) => s.title.trim()).map((s: any, i: number) => ({
          id: String(i),
          title: s.title.trim(),
          description: s.description?.trim() || null,
        })),
      },
    }),
    onSuccess: () => { toast.success("Template salvo"); setTplDlg(false); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });
  const delTpl = useMutation({
    mutationFn: (id: string) => delTplFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const createProj = useMutation({
    mutationFn: () => createProjFn({
      data: {
        organization_id: orgId!,
        template_id: projDraft.template_id || null,
        company_id: projDraft.company_id || null,
        name: projDraft.name.trim(),
        started_at: projDraft.started_at || null,
        notes: projDraft.notes?.trim() || null,
      },
    }),
    onSuccess: () => { toast.success("Projeto criado"); setProjDlg(false); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (v: { project_id: string; step_id: string; done: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: any) => toast.error(e.message),
  });
  const status = useMutation({
    mutationFn: (v: { id: string; status: any }) => statusFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries(); setDetail(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const delProj = useMutation({
    mutationFn: (id: string) => delProjFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNewTpl = () => { setTplDraft(emptyTpl()); setTplDlg(true); };
  const openEditTpl = (t: any) => {
    setTplDraft({
      id: t.id, name: t.name, description: t.description ?? "",
      duration_days: t.duration_days, is_active: t.is_active,
      steps: (t.steps ?? []).length ? t.steps : [{ id: "0", title: "", description: "" }],
    });
    setTplDlg(true);
  };

  const totals = projsData?.totals ?? { not_started: 0, in_progress: 0, completed: 0, late: 0, avg_progress: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Rocket className="h-6 w-6" /> Onboarding de Clientes
          </h1>
          <p className="text-sm text-muted-foreground">Acelere a ativação de novos clientes com playbooks padronizados.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openNewTpl}><ListChecks className="h-4 w-4 mr-1" /> Novo template</Button>
          <Button onClick={() => { setProjDraft(emptyProj()); setProjDlg(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo onboarding
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Em andamento</p>
          <p className="text-2xl font-bold text-primary">{totals.in_progress}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Concluídos</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totals.completed}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Atrasados</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{totals.late}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Progresso médio</p>
          <p className="text-2xl font-bold">{totals.avg_progress}%</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Projetos</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-3">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="not_started">Não iniciados</TabsTrigger>
              <TabsTrigger value="in_progress">Em andamento</TabsTrigger>
              <TabsTrigger value="completed">Concluídos</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (projsData?.projects ?? []).length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <Rocket className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum onboarding em andamento.</p>
            </CardContent></Card>
          ) : (
            <Card><CardContent className="p-0">
              <div className="divide-y">
                {(projsData?.projects ?? []).map((p: any) => (
                  <div key={p.id} className="p-3 flex items-center gap-3 hover:bg-accent/30 cursor-pointer"
                    onClick={() => setDetail(p)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{p.name}</p>
                        <Badge variant={STATUS_BADGE[p.status]} className="text-[10px]">{STATUS_LABEL[p.status]}</Badge>
                        {p.health === "red" && <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>}
                        {p.companies?.name && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {p.companies.name}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden max-w-xs">
                        <div className="h-full bg-primary transition-all" style={{ width: `${p.progress_pct}%` }} />
                      </div>
                      <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span>{p.progress_pct}% concluído</span>
                        {p.due_at && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> Previsto: {new Date(p.due_at).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {p.onboarding_templates?.name && (
                          <span>Template: {p.onboarding_templates.name}</span>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("Excluir?")) delProj.mutate(p.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-3">
          {!(tplsData?.templates ?? []).length ? (
            <Card><CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
              <ListChecks className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum template ainda.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {(tplsData?.templates ?? []).map((t: any) => (
                <Card key={t.id}><CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{t.name}</p>
                        <Badge variant={t.is_active ? "default" : "outline"} className="text-[10px]">
                          {t.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {(t.steps ?? []).length} etapas · {t.duration_days} dias
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditTpl(t)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => { if (confirm("Excluir template?")) delTpl.mutate(t.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template dialog */}
      <Dialog open={tplDlg} onOpenChange={setTplDlg}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tplDraft.id ? "Editar template" : "Novo template"}</DialogTitle>
            <DialogDescription>Defina as etapas padrão para onboardings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <div><Label>Nome</Label>
                <Input value={tplDraft.name} onChange={(e) => setTplDraft({ ...tplDraft, name: e.target.value })} />
              </div>
              <div><Label>Duração (dias)</Label>
                <Input type="number" min={1} value={tplDraft.duration_days}
                  onChange={(e) => setTplDraft({ ...tplDraft, duration_days: Number(e.target.value) })} />
              </div>
            </div>
            <div><Label>Descrição</Label>
              <Textarea rows={2} value={tplDraft.description}
                onChange={(e) => setTplDraft({ ...tplDraft, description: e.target.value })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Etapas</Label>
                <Button size="sm" variant="outline"
                  onClick={() => setTplDraft({ ...tplDraft, steps: [...tplDraft.steps, { id: String(tplDraft.steps.length), title: "", description: "" }] })}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar etapa
                </Button>
              </div>
              <div className="space-y-2">
                {tplDraft.steps.map((s: any, i: number) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input placeholder="Título" value={s.title}
                      onChange={(e) => { const ns = [...tplDraft.steps]; ns[i] = { ...ns[i], title: e.target.value }; setTplDraft({ ...tplDraft, steps: ns }); }} />
                    <Input placeholder="Descrição" value={s.description ?? ""}
                      onChange={(e) => { const ns = [...tplDraft.steps]; ns[i] = { ...ns[i], description: e.target.value }; setTplDraft({ ...tplDraft, steps: ns }); }} />
                    <Button size="sm" variant="ghost"
                      onClick={() => setTplDraft({ ...tplDraft, steps: tplDraft.steps.filter((_: any, j: number) => j !== i) })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTplDlg(false)}>Cancelar</Button>
            <Button disabled={!tplDraft.name.trim() || upsertTpl.isPending} onClick={() => upsertTpl.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New project dialog */}
      <Dialog open={projDlg} onOpenChange={setProjDlg}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo onboarding</DialogTitle>
            <DialogDescription>Crie a partir de um template ou em branco.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Template</Label>
              <Select value={projDraft.template_id ?? "_none"}
                onValueChange={(v) => setProjDraft({ ...projDraft, template_id: v === "_none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Em branco" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Em branco</SelectItem>
                  {(tplsData?.templates ?? []).filter((t: any) => t.is_active).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nome do projeto</Label>
              <Input value={projDraft.name} onChange={(e) => setProjDraft({ ...projDraft, name: e.target.value })}
                placeholder="Onboarding Acme Corp" />
            </div>
            <div><Label>Data de início</Label>
              <Input type="date" value={projDraft.started_at}
                onChange={(e) => setProjDraft({ ...projDraft, started_at: e.target.value })} />
            </div>
            <div><Label>Notas</Label>
              <Textarea rows={2} value={projDraft.notes}
                onChange={(e) => setProjDraft({ ...projDraft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjDlg(false)}>Cancelar</Button>
            <Button disabled={!projDraft.name.trim() || createProj.isPending} onClick={() => createProj.mutate()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Rocket className="h-5 w-5" /> {detail.name}</DialogTitle>
                <DialogDescription>
                  <Badge variant={STATUS_BADGE[detail.status]} className="mr-2">{STATUS_LABEL[detail.status]}</Badge>
                  {detail.progress_pct}% concluído
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${detail.progress_pct}%` }} />
                </div>
                <div className="space-y-2">
                  {(detail.steps ?? []).map((s: any, i: number) => {
                    const sid = String(s.id ?? i);
                    return (
                      <div key={sid} className="flex items-start gap-3 p-2 rounded border">
                        <Checkbox checked={!!s.done}
                          onCheckedChange={(v) => toggle.mutate({ project_id: detail.id, step_id: sid, done: !!v })} />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${s.done ? "line-through text-muted-foreground" : ""}`}>{s.title}</p>
                          {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                          {s.done && s.done_at && <p className="text-[11px] text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> {new Date(s.done_at).toLocaleString("pt-BR")}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  {detail.status !== "completed" && (
                    <Button size="sm" variant="default"
                      onClick={() => status.mutate({ id: detail.id, status: "completed" })}>
                      <Check className="h-3 w-3 mr-1" /> Marcar concluído
                    </Button>
                  )}
                  {detail.status !== "cancelled" && detail.status !== "completed" && (
                    <Button size="sm" variant="outline"
                      onClick={() => status.mutate({ id: detail.id, status: "cancelled" })}>
                      <X className="h-3 w-3 mr-1" /> Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
