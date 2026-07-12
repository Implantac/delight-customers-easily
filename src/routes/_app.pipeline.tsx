import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { EmptyState } from "@/components/empty-state";
import { Plus, Trash2, Target, TrendingUp, Trophy, Flame, DollarSign, Search, User, Clock, Snowflake, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { dealSchema, fromForm } from "@/lib/validation";
import { AIInsights } from "@/components/ai-insights";
import { Attachments } from "@/components/attachments";
import { TagPicker } from "@/components/tag-picker";
import { DealHistory } from "@/components/deal-history";
import { DealPlaybook } from "@/components/deal-playbook";
import { DealInsightPanel } from "@/components/deal-insight-panel";
import { DraftEmailButton } from "@/components/draft-email-button";
import { useServerFn } from "@tanstack/react-start";
import { triggerWebhooks } from "@/lib/webhooks.functions";
import { runAutomations } from "@/lib/automations.functions";
import { scoreDeal, HEAT_STYLES } from "@/lib/deal-score";

export const Route = createFileRoute("/_app/pipeline")({ component: PipelinePage });

const STAGES = [
  { id: "lead", label: "Lead", color: "border-l-slate-400" },
  { id: "qualified", label: "Qualificado", color: "border-l-blue-500" },
  { id: "proposal", label: "Proposta", color: "border-l-violet-500" },
  { id: "negotiation", label: "Negociação", color: "border-l-amber-500" },
  { id: "won", label: "Ganho", color: "border-l-emerald-500" },
  { id: "lost", label: "Perdido", color: "border-l-rose-500" },
] as const;

type Stage = typeof STAGES[number]["id"];
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function PipelinePage() {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Stage | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [minValue, setMinValue] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [quickAddStage, setQuickAddStage] = useState<Stage | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");




  const { data: deals, isLoading } = useQuery({
    queryKey: ["deals", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, title, stage, value, user_id, updated_at, created_at, expected_close, contact_id, company_id, contacts(name), companies(name), ai_deal_insights(win_probability, next_actions, risk_level, summary)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Última entrada no estágio atual por deal — usa deal_events (event_type = 'stage_changed').
  // Serve para mostrar "no estágio há Xd" real, sem depender de updated_at genérico.
  const { data: stageEntries } = useQuery({
    queryKey: ["deal-stage-entries", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_events")
        .select("deal_id, created_at, to_value")
        .eq("organization_id", orgId!)
        .eq("event_type", "stage_changed")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const e of data ?? []) {
        if (!map.has(e.deal_id)) map.set(e.deal_id, e.created_at);
      }
      return map;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-list-min", orgId],
    enabled: !!orgId,
    queryFn: async () => (await supabase.from("contacts").select("id, name, company_id").eq("organization_id", orgId!).order("name")).data ?? [],
    staleTime: 5 * 60_000,
  });

  const { data: companies } = useQuery({
    queryKey: ["companies-list-min", orgId],
    enabled: !!orgId,
    queryFn: async () => (await supabase.from("companies").select("id, name").eq("organization_id", orgId!).order("name")).data ?? [],
    staleTime: 5 * 60_000,
  });

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      if (!orgId) throw new Error("Nenhuma organização ativa");
      const parsed = fromForm(dealSchema, form);
      const { data: inserted, error } = await supabase.from("deals").insert({
        user_id: user!.id,
        organization_id: orgId,
        ...parsed,
      }).select("id, title, stage, value").single();
      if (error) throw error;
      if (orgId && inserted) {
        const payload = { deal_id: inserted.id, deal: inserted, ...parsed };
        fire({ data: { organization_id: orgId, event: "deal.created", payload } }).catch(() => {});
        runRules({ data: { organization_id: orgId, event: "deal.created", payload } }).catch(() => {});
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); setOpen(false); toast.success("Negócio criado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const fire = useServerFn(triggerWebhooks);
  const runRules = useServerFn(runAutomations);

  // Quick-add inline no Kanban — só título + estágio, respeita a regra de "menos digitação".
  const quickAdd = useMutation({
    mutationFn: async ({ title, stage }: { title: string; stage: Stage }) => {
      if (!orgId) throw new Error("Nenhuma organização ativa");
      const clean = title.trim();
      if (!clean) throw new Error("Informe um título");
      const { data: inserted, error } = await supabase.from("deals").insert({
        user_id: user!.id,
        organization_id: orgId,
        title: clean,
        stage,
        value: 0,
      }).select("id, title, stage, value").single();
      if (error) throw error;
      if (orgId && inserted) {
        const payload = { deal_id: inserted.id, deal: inserted, title: clean, stage, value: 0 };
        fire({ data: { organization_id: orgId, event: "deal.created", payload } }).catch(() => {});
        runRules({ data: { organization_id: orgId, event: "deal.created", payload } }).catch(() => {});
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      setQuickAddTitle("");
      setQuickAddStage(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, stage, prevStage, deal }: { id: string; stage: Stage; prevStage: Stage; deal: any }) => {
      const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
      if (error) throw error;
      if (prevStage !== stage && orgId) {
        const events = ["deal.stage_changed"];
        if (stage === "won") events.push("deal.won");
        if (stage === "lost") events.push("deal.lost");
        const payload = { deal_id: id, from_stage: prevStage, to_stage: stage, deal };
        for (const ev of events) {
          fire({ data: { organization_id: orgId, event: ev, payload } }).catch(() => {});
          runRules({ data: { organization_id: orgId, event: ev, payload } }).catch(() => {});
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); toast.success("Removido"); setSelectedId(null); },
  });

  const selected = (deals ?? []).find((d) => d.id === selectedId) ?? null;

  return (
    <div className="page-container max-w-[1600px]">
      <PageHeader
        title="Pipeline de Leads"
        subtitle="Onde os negócios acontecem. Arraste para mover, foque no que está quente."
        icon={Target}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="h-9 px-4 font-medium transition-all hover:shadow-glow">
                <Plus className="mr-2 h-4 w-4" /> Novo negócio
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Novo negócio</DialogTitle>
                <DialogDescription>Preencha os dados básicos para iniciar o acompanhamento.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
                <div className="space-y-1.5"><Label>Título *</Label><Input name="title" required maxLength={150} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Valor (R$)</Label><Input name="value" type="number" step="0.01" defaultValue="0" /></div>
                  <div className="space-y-1.5">
                    <Label>Estágio</Label>
                    <Select name="stage" defaultValue="lead">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Contato</Label>
                    <Select name="contact_id">
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{contacts?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Empresa</Label>
                    <Select name="company_id">
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{companies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Fechamento previsto</Label><Input name="expected_close" type="date" /></div>
                <div className="space-y-1.5"><Label>Notas</Label><Textarea name="notes" maxLength={1000} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Criar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <PipelineKpis loading={isLoading} deals={deals ?? []} />

      <div className="mt-4"><NextActionBlock surface="pipeline" /></div>

      {/* Filter bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, contato ou empresa…"
            className="pl-8 h-9"
          />
        </div>
        <Input
          type="number"
          inputMode="numeric"
          value={minValue}
          onChange={(e) => setMinValue(e.target.value)}
          placeholder="Valor mín."
          className="h-9 w-32"
        />
        <Button
          variant={onlyMine ? "default" : "outline"}
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => setOnlyMine((v) => !v)}
        >
          <User className="h-3.5 w-3.5" /> Só meus
        </Button>
        {(q || minValue || onlyMine) && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setQ(""); setMinValue(""); setOnlyMine(false); }}>
            Limpar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((s) => <Skeleton key={s.id} className="h-64 w-full" />)}
        </div>
      ) : (deals ?? []).length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Target} title="Sem negócios" description="Crie seu primeiro negócio para começar a acompanhar o funil." />
        </div>
      ) : (
        <div className="mt-8 flex gap-4 overflow-x-auto pb-6 scrollbar-hide md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-6 min-h-[600px]">
          {STAGES.map((stage) => {
            const minV = Number(minValue) || 0;
            const ql = q.trim().toLowerCase();
            const items = (deals ?? [])
              .filter((d) => d.stage === stage.id)
              .filter((d) => !onlyMine || d.user_id === user?.id)
              .filter((d) => !minV || Number(d.value) >= minV)
              .filter((d) => {
                if (!ql) return true;
                const cn = (d.contacts as any)?.name ?? "";
                const co = (d.companies as any)?.name ?? "";
                return (
                  (d.title ?? "").toLowerCase().includes(ql) ||
                  cn.toLowerCase().includes(ql) ||
                  co.toLowerCase().includes(ql)
                );
              })
              .map((d) => ({ ...d, _score: scoreDeal(d as any) }))
              .sort((a, b) => b._score.probability - a._score.probability);

            const sum = items.reduce((s, d) => s + Number(d.value), 0);
            return (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); if (dragOverStage !== stage.id) setDragOverStage(stage.id); }}
                onDragLeave={(e) => {
                  // only clear when leaving the column entirely
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDragOverStage((s) => (s === stage.id ? null : s));
                }}
                onDrop={() => {
                  setDragOverStage(null);
                  if (!dragId) return;
                  const d = (deals ?? []).find((x) => x.id === dragId);
                  if (d && d.stage !== stage.id) move.mutate({ id: dragId, stage: stage.id, prevStage: d.stage as Stage, deal: { title: d.title, value: d.value } });
                  setDragId(null);
                }}
                className={`flex w-[85vw] shrink-0 flex-col rounded-[2rem] border bg-secondary/10 p-4 transition-all duration-500 md:w-auto md:shrink ${
                  dragOverStage === stage.id && dragId
                    ? "border-primary/40 bg-primary/5 ring-8 ring-primary/5 scale-[1.01]"
                    : "border-border/30 hover:border-border/60 shadow-sm"
                }`}
              >
                <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 rounded-t-[2rem] bg-card/60 px-5 py-4 backdrop-blur-xl border-b border-border/10">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-bold uppercase tracking-widest text-foreground/80">{stage.label}</span>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] bg-secondary/80 font-bold border-none">
                        {items.length}
                      </Badge>
                      {stage.id !== "won" && stage.id !== "lost" && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                          onClick={() => {
                            setQuickAddStage(stage.id as Stage);
                            setQuickAddTitle("");
                          }}
                          title="Adicionar rápido nesta coluna"
                          aria-label={`Adicionar rápido em ${stage.label}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-sm font-display font-bold tracking-tight text-primary/80">{fmtBRL(sum)}</p>
                </div>

                {quickAddStage === stage.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      quickAdd.mutate({ title: quickAddTitle, stage: stage.id as Stage });
                    }}
                    className="mb-2 flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 p-1.5"
                  >
                    <Input
                      autoFocus
                      value={quickAddTitle}
                      onChange={(e) => setQuickAddTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { setQuickAddStage(null); setQuickAddTitle(""); }
                      }}
                      onBlur={() => {
                        // se saiu vazio sem submeter, fecha
                        if (!quickAddTitle.trim() && !quickAdd.isPending) setQuickAddStage(null);
                      }}
                      placeholder="Título do negócio…"
                      maxLength={150}
                      className="h-8 text-sm border-0 bg-transparent focus-visible:ring-0 shadow-none"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      disabled={quickAdd.isPending || !quickAddTitle.trim()}
                    >
                      {quickAdd.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                    </Button>
                  </form>
                )}


                <div className="flex-1 space-y-2">
                  {items.length === 0 && (
                    <div className={`flex h-20 items-center justify-center rounded-lg border-2 border-dashed text-xs transition-colors ${
                      dragOverStage === stage.id && dragId
                        ? "border-primary/60 text-primary"
                        : "border-border/40 text-muted-foreground/60"
                    }`}>
                      {dragOverStage === stage.id && dragId ? "Solte aqui" : "Vazio"}
                    </div>
                  )}
                  {items.map((d) => {
                    const heat = HEAT_STYLES[d._score.heat];
                    const isDragging = dragId === d.id;
                    return (
                      <Card
                        key={d.id}
                        draggable
                        onDragStart={() => setDragId(d.id)}
                        onDragEnd={() => { setDragId(null); setDragOverStage(null); }}
                        onClick={() => setSelectedId(d.id)}
                        className={`group cursor-grab border-l-[4px] p-5 transition-all duration-300 hover:-translate-y-1 active:cursor-grabbing bg-card/80 backdrop-blur-sm border-border/40 rounded-2xl shadow-sm hover:shadow-xl ${stage.color} ${
                          isDragging ? "opacity-30 rotate-2 scale-90" : ""
                        }`}
                        title={d._score.reasons.join(" · ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="flex-1 text-sm font-bold leading-snug group-hover:text-primary transition-colors">{d.title}</h4>
                          <span className={`flex h-2 w-2 shrink-0 rounded-full ${heat.dot} ring-4 ${heat.ring} mt-1`} />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between gap-2">
                          <p className="text-[15px] font-display font-bold text-foreground">{fmtBRL(Number(d.value))}</p>
                          {d.stage !== "won" && d.stage !== "lost" && (
                            <span className="text-[11px] font-semibold tabular-nums text-foreground/80">
                              {d._score.probability}% <span className="font-normal text-muted-foreground">prob.</span>
                            </span>
                          )}
                        </div>
                        {d.stage !== "won" && d.stage !== "lost" && (
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/60" title={`Probabilidade estimada: ${d._score.probability}%`}>
                            <div
                              className={`h-full rounded-full transition-all ${
                                d._score.probability >= 70 ? "bg-emerald-500"
                                : d._score.probability >= 40 ? "bg-amber-500"
                                : "bg-rose-500"
                              }`}
                              style={{ width: `${d._score.probability}%` }}
                            />
                          </div>
                        )}
                        {(() => {
                          const ins: any = Array.isArray((d as any).ai_deal_insights)
                            ? (d as any).ai_deal_insights[0]
                            : (d as any).ai_deal_insights;
                          const acts = Array.isArray(ins?.next_actions) ? ins.next_actions : [];
                          const first = acts[0];
                          const label = typeof first === "string"
                            ? first
                            : (first?.action ?? first?.title ?? first?.text ?? null);
                          if (!label) return null;
                          const risk = ins?.risk_level as string | undefined;
                          const tone = risk === "high"
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30"
                            : "bg-primary/15 text-primary ring-1 ring-primary/25";
                          return (
                            <div
                              className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}
                              title={ins?.summary ?? label}
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              <span className="truncate max-w-[180px]">{label}</span>
                            </div>
                          );
                        })()}
                        {((d.contacts as any)?.name || (d.companies as any)?.name) && (
                          <p className="mt-2 truncate text-xs text-muted-foreground">
                            {(d.contacts as any)?.name}{(d.contacts as any)?.name && (d.companies as any)?.name ? " · " : ""}{(d.companies as any)?.name}
                          </p>
                        )}
                        {(() => {
                          if (d.stage === "won" || d.stage === "lost") return null;
                          const entered = stageEntries?.get(d.id) ?? d.created_at;
                          if (!entered) return null;
                          const days = Math.max(0, Math.floor((Date.now() - new Date(entered).getTime()) / 86400000));
                          const frozen = days >= 14;
                          const cold = !frozen && days >= 5;
                          const StaleIcon = (cold || frozen) ? Snowflake : Clock;
                          const staleLabel = frozen
                            ? `Gelado · ${days}d sem interação`
                            : cold
                              ? `Frio · ${days}d sem interação`
                              : `Entrou no estágio em ${new Date(entered).toLocaleDateString("pt-BR")}`;
                          const staleText = frozen
                            ? `gelado ${days}d`
                            : cold
                              ? `frio ${days}d`
                              : (days === 0 ? "hoje" : `${days}d no estágio`);
                          return (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  frozen
                                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/30"
                                    : cold
                                      ? "bg-sky-500/10 text-sky-700/90 dark:text-sky-300/90"
                                      : "bg-muted text-muted-foreground"
                                }`}
                                title={staleLabel}
                              >
                                <StaleIcon className="h-2.5 w-2.5" />
                                {staleText}
                              </span>
                              {d.expected_close && (() => {
                                const dd = Math.floor((new Date(d.expected_close as string).getTime() - Date.now()) / 86400000);
                                if (dd < 0) return (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-400">
                                    atrasado {Math.abs(dd)}d
                                  </span>
                                );
                                if (dd <= 7) return (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                    fecha em {dd}d
                                  </span>
                                );
                                return null;
                              })()}
                            </div>
                          );
                        })()}


                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}


      <DealDrawer
        deal={selected}
        contacts={contacts ?? []}
        companies={companies ?? []}
        onClose={() => setSelectedId(null)}
        onDelete={(id) => { if (confirm("Remover este negócio?")) del.mutate(id); }}
      />
    </div>
  );
}

function DealDrawer({
  deal, contacts, companies, onClose, onDelete,
}: {
  deal: any | null;
  contacts: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { orgId } = useCurrentOrg();
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (deal) setForm({
      title: deal.title,
      value: deal.value,
      stage: deal.stage,
      contact_id: deal.contact_id ?? "",
      company_id: deal.company_id ?? "",
      expected_close: deal.expected_close ?? "",
      notes: deal.notes ?? "",
    });
  }, [deal?.id]);

  const { data: activities } = useQuery({
    queryKey: ["deal-activities", deal?.id],
    enabled: !!deal?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, type, title, completed, due_date")
        .eq("deal_id", deal!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!deal) return;
      const parsed = dealSchema.parse({
        ...form,
        contact_id: form.contact_id || undefined,
        company_id: form.company_id || undefined,
        expected_close: form.expected_close || undefined,
        notes: form.notes || undefined,
      });
      const { error } = await supabase.from("deals").update(parsed).eq("id", deal.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); toast.success("Negócio atualizado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={!!deal} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar negócio</SheetTitle>
        </SheetHeader>
        {form && deal && (
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={150} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Estágio</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contato</Label>
                <Select value={form.contact_id || "_none"} onValueChange={(v) => setForm({ ...form, contact_id: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Select value={form.company_id || "_none"} onValueChange={(v) => setForm({ ...form, company_id: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Fechamento</Label><Input type="date" value={form.expected_close} onChange={(e) => setForm({ ...form, expected_close: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} rows={4} /></div>

            <div className="border-t pt-4">
              <h4 className="mb-2 text-sm font-semibold">Atividades vinculadas</h4>
              {!activities?.length ? (
                <p className="text-xs text-muted-foreground">Nenhuma atividade ainda.</p>
              ) : (
                <ul className="space-y-1.5">
                  {activities.map((a: any) => (
                    <li key={a.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <span className={a.completed ? "text-muted-foreground line-through" : ""}>{a.title}</span>
                      <span className="text-xs text-muted-foreground">{a.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <AIInsights dealId={deal.id} actions={["score_deal"]} />

            <DealInsightPanel dealId={deal.id} />

            {orgId && (
              <div className="flex justify-end">
                <DraftEmailButton organizationId={orgId} dealId={deal.id} contactId={deal.contact_id ?? undefined} />
              </div>
            )}

            <DealPlaybook
              stage={form.stage ?? deal.stage}
              vars={{
                first_name: contacts.find((c) => c.id === deal.contact_id)?.name?.split(" ")[0],
                company: companies.find((c) => c.id === deal.company_id)?.name,
                deadline: deal.expected_close ?? undefined,
              }}
            />

            <div className="border-t pt-4">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Etiquetas</p>
              <TagPicker entityType="deal" entityId={deal.id} />
            </div>

            <Attachments entityType="deal" entityId={deal.id} />

            <DealHistory dealId={deal.id} />



            <SheetFooter className="gap-2 sm:gap-2">
              <Button variant="destructive" size="sm" onClick={() => onDelete(deal.id)}>
                <Trash2 className="mr-1 h-4 w-4" /> Remover
              </Button>
              <Button onClick={() => update.mutate()} disabled={update.isPending}>Salvar</Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PipelineKpis({ loading, deals }: { loading: boolean; deals: any[] }) {
  const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const won = deals.filter((d) => d.stage === "won");
  const openValue = open.reduce((s, d) => s + Number(d.value || 0), 0);
  const wonValue = won.reduce((s, d) => s + Number(d.value || 0), 0);
  const avg = open.length ? openValue / open.length : 0;
  const hot = open.filter((d) => scoreDeal(d).probability >= 70).length;
  return (
    <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
      <PKpi loading={loading} label="Pipeline aberto" value={fmtBRL(openValue)} sub={`${open.length} negócios`} icon={TrendingUp} tone="primary" />
      <PKpi loading={loading} label="Ticket médio" value={fmtBRL(avg)} icon={DollarSign} />
      <PKpi loading={loading} label="Negócios quentes" value={hot} sub="prob. ≥ 70%" icon={Flame} tone="warn" />
      <PKpi loading={loading} label="Ganho acumulado" value={fmtBRL(wonValue)} sub={`${won.length} ganhos`} icon={Trophy} tone="ok" />
    </div>
  );
}

function PKpi({
  loading, label, value, sub, icon: Icon, tone,
}: {
  loading: boolean; label: string; value: number | string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "ok" | "warn" | "primary";
}) {
  const color =
    tone === "ok" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "warn" ? "text-amber-600 dark:text-amber-400"
    : tone === "primary" ? "text-primary"
    : "text-foreground";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>
        {loading ? <Skeleton className="h-7 w-24" /> : value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}
