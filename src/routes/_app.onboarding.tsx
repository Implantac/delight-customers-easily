import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Rocket, Plus, Trash2, Pencil, Check, X, ListChecks, CalendarDays, Building2, BookOpen, Clock, FileText, LayoutDashboard, Share2, AlertTriangle, ChevronRight, Download } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { cn } from "@/lib/utils";
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
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader
        title="Implantação & Onboarding"
        subtitle="Acelere a ativação de novos clientes com playbooks padronizados e gestão de treinamentos."
        icon={Rocket}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={openNewTpl} className="hidden md:flex">
              <ListChecks className="h-4 w-4 mr-2" /> Templates
            </Button>
            <Button onClick={() => { setProjDraft(emptyProj()); setProjDlg(true); }} className="font-bold">
              <Plus className="h-4 w-4 mr-2" /> Novo Onboarding
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-4">
        <StatsCard title="Ativos" value={totals.in_progress} icon={Clock} color="text-blue-500" />
        <StatsCard title="Sucesso" value={totals.completed} icon={Check} color="text-emerald-500" />
        <StatsCard title="Atrasados" value={totals.late} icon={AlertTriangle} color="text-rose-500" />
        <StatsCard title="Saúde Média" value={`${totals.avg_progress}%`} icon={Rocket} color="text-violet-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="projects" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="projects" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" /> Projetos
                </TabsTrigger>
                <TabsTrigger value="training" className="gap-2">
                  <BookOpen className="h-4 w-4" /> Treinamentos
                </TabsTrigger>
                <TabsTrigger value="docs" className="gap-2">
                  <FileText className="h-4 w-4" /> Documentos
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="projects" className="space-y-4 outline-none">
              <div className="flex items-center gap-2 mb-2">
                {["all", "not_started", "in_progress", "completed"].map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? "secondary" : "ghost"}
                    size="sm"
                    className="text-[10px] uppercase tracking-widest font-bold"
                    onClick={() => setFilter(f)}
                  >
                    {f === "all" ? "Todos" : STATUS_LABEL[f] || f}
                  </Button>
                ))}
              </div>

              {isLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
              ) : (projsData?.projects ?? []).length === 0 ? (
                <Card className="border-dashed"><CardContent className="flex flex-col items-center py-16 text-center text-muted-foreground">
                  <Rocket className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">Nenhum onboarding encontrado nesta categoria.</p>
                </CardContent></Card>
              ) : (
                <div className="grid gap-4">
                  {(projsData?.projects ?? []).map((p: any) => (
                    <Card key={p.id} className="group hover:border-primary/30 transition-all cursor-pointer overflow-hidden border-border/40"
                      onClick={() => setDetail(p)}>
                      <CardContent className="p-0">
                        <div className="p-5 flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                            p.status === "completed" ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                          )}>
                            <Building2 className="h-6 w-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-base truncate">{p.name}</h4>
                              <Badge variant={STATUS_BADGE[p.status]} className="text-[9px] uppercase tracking-tighter">
                                {STATUS_LABEL[p.status]}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {new Date(p.started_at).toLocaleDateString("pt-BR")}</span>
                              <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> {(p.steps_done_count || 0)}/{(p.steps_total_count || 0)} etapas</span>
                            </div>
                          </div>
                          <div className="text-right hidden sm:block">
                            <div className="text-lg font-bold font-mono">{p.progress_pct}%</div>
                            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${p.progress_pct}%` }} />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="training" className="outline-none">
              <Card className="border-border/40">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" /> Cronograma de Treinamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <TrainingItem title="Treinamento Administrativo" date="14 Jun, 14:00" attendee="João (Admin)" status="confirmed" />
                    <TrainingItem title="Configuração de Regras de Negócio" date="16 Jun, 10:00" attendee="Maria (Gestora)" status="pending" />
                    <TrainingItem title="Treinamento Time de Vendas" date="20 Jun, 09:00" attendee="Toda Equipe" status="planned" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="docs" className="outline-none">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DocCard title="Playbook de Implantação" type="PDF" size="2.4 MB" />
                  <DocCard title="Checklist de Homologação" type="XLSX" size="156 KB" />
                  <DocCard title="Manual do Administrador" type="PDF" size="5.1 MB" />
                  <DocCard title="Script de Importação ERP" type="DOCX" size="88 KB" />
               </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <ErpSyncHealth />
          
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Share2 className="h-4 w-4 text-primary" /> Compartilhar Portal do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Envie um link seguro para o cliente acompanhar o progresso em tempo real.</p>
              <Button className="w-full font-bold" variant="outline">Copiar Link do Portal</Button>
            </CardContent>
          </Card>
        </div>
      </div>


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

function StatsCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        <p className="text-2xl font-display font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function TrainingItem({ title, date, attendee, status }: any) {
  const statusConfig: any = {
    confirmed: { label: "Confirmado", color: "bg-emerald-500/10 text-emerald-500" },
    pending: { label: "Aguardando", color: "bg-amber-500/10 text-amber-500" },
    planned: { label: "Planejado", color: "bg-blue-500/10 text-blue-500" },
  };
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-background/50 hover:border-primary/20 transition-all">
      <div className="flex gap-3 items-center">
        <div className="p-2 rounded-lg bg-secondary">
          <CalendarDays className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-bold">{title}</div>
          <div className="text-[10px] text-muted-foreground">{date} • {attendee}</div>
        </div>
      </div>
      <Badge variant="outline" className={cn("text-[10px] uppercase border-none", statusConfig[status].color)}>
        {statusConfig[status].label}
      </Badge>
    </div>
  );
}

function DocCard({ title, type, size }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/50 hover:border-primary/20 transition-all group">
      <div className="flex gap-3 items-center">
        <div className="p-2 rounded-lg bg-primary/5 group-hover:bg-primary/10 transition-colors">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="text-sm font-bold">{title}</div>
          <div className="text-[10px] text-muted-foreground uppercase">{type} • {size}</div>
        </div>
      </div>
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
