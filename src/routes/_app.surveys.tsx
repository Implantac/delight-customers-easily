import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { ClipboardCheck, Plus, Pencil, Trash2, Star, Smile, Frown, Meh, MessageSquareText } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  listSurveys, upsertSurvey, deleteSurvey, recordResponse, deleteResponse,
} from "@/lib/surveys.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/surveys")({ component: SurveysPage });

const TYPE_LABEL: Record<string, string> = { nps: "NPS", csat: "CSAT", ces: "CES", custom: "Custom" };

function emptySurvey() {
  return {
    name: "",
    description: "",
    type: "nps" as const,
    question: "O quanto você recomendaria nosso produto para um amigo ou colega?",
    scale_min: 0,
    scale_max: 10,
    active: true,
  };
}

function npsCategory(score: number): { label: string; tone: "default" | "secondary" | "destructive" | "outline"; icon: any } {
  if (score >= 9) return { label: "Promotor", tone: "default", icon: Smile };
  if (score >= 7) return { label: "Neutro", tone: "secondary", icon: Meh };
  return { label: "Detrator", tone: "destructive", icon: Frown };
}

function SurveysPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const fetchFn = useServerFn(listSurveys);
  const upsertFn = useServerFn(upsertSurvey);
  const delFn = useServerFn(deleteSurvey);
  const respondFn = useServerFn(recordResponse);
  const delRespFn = useServerFn(deleteResponse);

  const [tab, setTab] = useState<"surveys" | "responses">("surveys");
  const [editDlg, setEditDlg] = useState(false);
  const [draft, setDraft] = useState<any>({ ...emptySurvey() });
  const [respondDlg, setRespondDlg] = useState<any>(null);
  const [respDraft, setRespDraft] = useState<any>({ score: 10, comment: "", respondent_name: "", respondent_email: "" });
  const [selectedId, setSelectedId] = useState<string | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["surveys", orgId],
    enabled: !!orgId,
    queryFn: () => fetchFn({ data: { organization_id: orgId! } }),
  });

  const surveys = data?.surveys ?? [];
  const responses = data?.responses ?? [];
  const stats = data?.stats ?? {};

  const filteredResponses = useMemo(
    () => (selectedId === "all" ? responses : responses.filter((r) => r.survey_id === selectedId)),
    [responses, selectedId],
  );

  const globalStats = useMemo(() => {
    const total = responses.length;
    const npsSurveys = surveys.filter((s) => s.type === "nps");
    const npsResps = responses.filter((r) => npsSurveys.some((s) => s.id === r.survey_id));
    let promoters = 0, detractors = 0;
    for (const r of npsResps) {
      if (r.score >= 9) promoters++;
      else if (r.score <= 6) detractors++;
    }
    const nps = npsResps.length ? Math.round(((promoters - detractors) / npsResps.length) * 100) : null;
    const active = surveys.filter((s) => s.active).length;
    return { total, nps, active, npsCount: npsResps.length };
  }, [surveys, responses]);

  const upsert = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: draft.id,
          organization_id: orgId!,
          name: draft.name.trim(),
          description: draft.description?.trim() || null,
          type: draft.type,
          question: draft.question.trim(),
          scale_min: Number(draft.scale_min),
          scale_max: Number(draft.scale_max),
          active: draft.active,
        },
      }),
    onSuccess: () => {
      toast.success("Pesquisa salva");
      setEditDlg(false);
      qc.invalidateQueries({ queryKey: ["surveys"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Pesquisa removida"); qc.invalidateQueries({ queryKey: ["surveys"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const respond = useMutation({
    mutationFn: () =>
      respondFn({
        data: {
          organization_id: orgId!,
          survey_id: respondDlg.id,
          score: Number(respDraft.score),
          comment: respDraft.comment?.trim() || null,
          respondent_name: respDraft.respondent_name?.trim() || null,
          respondent_email: respDraft.respondent_email?.trim() || null,
          source: "manual",
        },
      }),
    onSuccess: () => {
      toast.success("Resposta registrada");
      setRespondDlg(null);
      qc.invalidateQueries({ queryKey: ["surveys"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeResp = useMutation({
    mutationFn: (id: string) => delRespFn({ data: { id } }),
    onSuccess: () => { toast.success("Resposta removida"); qc.invalidateQueries({ queryKey: ["surveys"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ ...emptySurvey() }); setEditDlg(true); };
  const openEdit = (s: any) => { setDraft({ ...s, description: s.description ?? "" }); setEditDlg(true); };
  const openRespond = (s: any) => {
    setRespondDlg(s);
    setRespDraft({ score: s.scale_max, comment: "", respondent_name: "", respondent_email: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" /> Pesquisas
          </h1>
          <p className="text-sm text-muted-foreground">NPS, CSAT e CES para medir satisfação e lealdade.</p>
        </div>
        {canManage && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova pesquisa</Button>}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pesquisas ativas</p>
          <p className="text-2xl font-bold">{globalStats.active}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Respostas totais</p>
          <p className="text-2xl font-bold">{globalStats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3" /> NPS geral</p>
          <p className="text-2xl font-bold">{globalStats.nps ?? "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Respostas NPS</p>
          <p className="text-2xl font-bold">{globalStats.npsCount}</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="surveys">Pesquisas</TabsTrigger>
          <TabsTrigger value="responses">Respostas</TabsTrigger>
        </TabsList>

        <TabsContent value="surveys" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : surveys.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
                <ClipboardCheck className="h-10 w-10 mb-2 opacity-40" />
                <p className="text-sm">Nenhuma pesquisa criada ainda.</p>
                {canManage && <Button className="mt-3" size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Criar primeira</Button>}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {surveys.map((s) => {
                const st = stats[s.id] ?? { count: 0, avg: 0, nps: null, promoters: 0, passives: 0, detractors: 0 };
                return (
                  <Card key={s.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{s.name}</p>
                            <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[s.type]}</Badge>
                            {s.active ? (
                              <Badge variant="default" className="text-[10px]">Ativa</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">Inativa</Badge>
                            )}
                          </div>
                          {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
                          <p className="text-xs italic text-muted-foreground mt-1">"{s.question}"</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="ghost" title="Registrar resposta" onClick={() => openRespond(s)}>
                            <MessageSquareText className="h-4 w-4" />
                          </Button>
                          {canManage && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost"
                                onClick={() => { if (confirm("Excluir pesquisa e suas respostas?")) remove.mutate(s.id); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-md border bg-muted/30 p-2">
                          <p className="text-[10px] text-muted-foreground uppercase">Respostas</p>
                          <p className="text-lg font-bold">{st.count}</p>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-2">
                          <p className="text-[10px] text-muted-foreground uppercase">Média</p>
                          <p className="text-lg font-bold">{st.count ? st.avg.toFixed(1) : "—"}</p>
                        </div>
                        <div className="rounded-md border bg-muted/30 p-2">
                          <p className="text-[10px] text-muted-foreground uppercase">{s.type === "nps" ? "NPS" : "Escala"}</p>
                          <p className="text-lg font-bold">
                            {s.type === "nps" ? (st.nps ?? "—") : `${s.scale_min}-${s.scale_max}`}
                          </p>
                        </div>
                      </div>

                      {s.type === "nps" && st.count > 0 && (
                        <div className="space-y-1">
                          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                            <div className="bg-destructive" style={{ width: `${(st.detractors / st.count) * 100}%` }} />
                            <div className="bg-secondary" style={{ width: `${(st.passives / st.count) * 100}%` }} />
                            <div className="bg-primary" style={{ width: `${(st.promoters / st.count) * 100}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{st.detractors} detratores</span>
                            <span>{st.passives} neutros</span>
                            <span>{st.promoters} promotores</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="responses" className="space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Pesquisa:</Label>
            <Select value={selectedId} onValueChange={(v) => setSelectedId(v as any)}>
              <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {surveys.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filteredResponses.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma resposta registrada.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredResponses.map((r) => {
                    const s = surveys.find((x) => x.id === r.survey_id);
                    const isNps = s?.type === "nps";
                    const cat = isNps ? npsCategory(r.score) : null;
                    const Icon = cat?.icon;
                    return (
                      <div key={r.id} className="flex items-start gap-3 p-3 hover:bg-accent/30">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted/30 text-sm font-bold">
                          {r.score}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{s?.name ?? "—"}</p>
                            {cat && Icon && (
                              <Badge variant={cat.tone} className="text-[10px] gap-1">
                                <Icon className="h-3 w-3" /> {cat.label}
                              </Badge>
                            )}
                            {r.respondent_name && <span className="text-xs text-muted-foreground">{r.respondent_name}</span>}
                            {r.respondent_email && <span className="text-xs text-muted-foreground">· {r.respondent_email}</span>}
                          </div>
                          {r.comment && <p className="text-sm mt-1 text-foreground/80">"{r.comment}"</p>}
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(r.responded_at).toLocaleString("pt-BR")}
                            {r.source && ` · ${r.source}`}
                          </p>
                        </div>
                        {canManage && (
                          <Button size="sm" variant="ghost"
                            onClick={() => { if (confirm("Excluir resposta?")) removeResp.mutate(r.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit survey dialog */}
      <Dialog open={editDlg} onOpenChange={setEditDlg}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar pesquisa" : "Nova pesquisa"}</DialogTitle>
            <DialogDescription>Defina o tipo, a pergunta e a escala de pontuação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="NPS pós-compra" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select value={draft.type} onValueChange={(v) => {
                  const min = v === "nps" ? 0 : 1;
                  const max = v === "nps" ? 10 : v === "csat" ? 5 : 7;
                  setDraft({ ...draft, type: v, scale_min: min, scale_max: max });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={draft.active} onCheckedChange={(c) => setDraft({ ...draft, active: c })} />
                <Label className="text-sm">Ativa</Label>
              </div>
            </div>
            <div>
              <Label>Pergunta</Label>
              <Textarea rows={2} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Escala mínima</Label>
                <Input type="number" min={0} max={10}
                  value={draft.scale_min} onChange={(e) => setDraft({ ...draft, scale_min: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Escala máxima</Label>
                <Input type="number" min={1} max={10}
                  value={draft.scale_max} onChange={(e) => setDraft({ ...draft, scale_max: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDlg(false)}>Cancelar</Button>
            <Button disabled={!draft.name?.trim() || !draft.question?.trim() || upsert.isPending}
              onClick={() => upsert.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Respond dialog */}
      <Dialog open={!!respondDlg} onOpenChange={(o) => !o && setRespondDlg(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar resposta</DialogTitle>
            <DialogDescription className="italic">"{respondDlg?.question}"</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Pontuação ({respondDlg?.scale_min}–{respondDlg?.scale_max})</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {respondDlg && Array.from({ length: respondDlg.scale_max - respondDlg.scale_min + 1 }).map((_, i) => {
                  const v = respondDlg.scale_min + i;
                  return (
                    <Button key={v} size="sm" variant={respDraft.score === v ? "default" : "outline"}
                      className="h-9 w-9 p-0"
                      onClick={() => setRespDraft({ ...respDraft, score: v })}>
                      {v}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Nome</Label>
                <Input value={respDraft.respondent_name}
                  onChange={(e) => setRespDraft({ ...respDraft, respondent_name: e.target.value })} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={respDraft.respondent_email}
                  onChange={(e) => setRespDraft({ ...respDraft, respondent_email: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Comentário (opcional)</Label>
              <Textarea rows={3} value={respDraft.comment}
                onChange={(e) => setRespDraft({ ...respDraft, comment: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDlg(null)}>Cancelar</Button>
            <Button disabled={respond.isPending} onClick={() => respond.mutate()}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
