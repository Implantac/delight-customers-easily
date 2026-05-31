import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Smile, Plus, Trash2, MessageSquarePlus, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/surveys")({ component: SurveysPage });

const TYPE_LABEL: Record<string, string> = { nps: "NPS", csat: "CSAT", ces: "CES", custom: "Custom" };

function scoreBadge(score: number) {
  if (score >= 9) return { label: "Promotor", variant: "default" as const };
  if (score >= 7) return { label: "Neutro", variant: "secondary" as const };
  return { label: "Detrator", variant: "destructive" as const };
}

function SurveysPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listSurveys);
  const saveFn = useServerFn(upsertSurvey);
  const delFn = useServerFn(deleteSurvey);
  const respFn = useServerFn(recordResponse);
  const delRespFn = useServerFn(deleteResponse);

  const [tab, setTab] = useState("overview");
  const [surveyDlg, setSurveyDlg] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>({
    name: "", description: "", type: "nps",
    question: "O quanto você recomendaria nossa empresa?", active: true,
  });

  const [respDlg, setRespDlg] = useState<any>(null);
  const [respDraft, setRespDraft] = useState<any>({
    score: "9", comment: "", respondent_name: "", respondent_email: "",
  });

  const q = useQuery({
    queryKey: ["surveys", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["surveys"] });

  const save = useMutation({
    mutationFn: (input: any) => saveFn({ data: input }),
    onSuccess: () => { toast.success("Pesquisa salva"); setSurveyDlg(false); setEditId(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Pesquisa removida"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const record = useMutation({
    mutationFn: (input: any) => respFn({ data: input }),
    onSuccess: () => { toast.success("Resposta registrada"); setRespDlg(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const delResp = useMutation({
    mutationFn: (id: string) => delRespFn({ data: { id } }),
    onSuccess: () => { toast.success("Resposta removida"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditId(null);
    setDraft({ name: "", description: "", type: "nps", question: "O quanto você recomendaria nossa empresa?", active: true });
    setSurveyDlg(true);
  };
  const openEdit = (s: any) => {
    setEditId(s.id);
    setDraft({ name: s.name, description: s.description ?? "", type: s.type, question: s.question, active: s.active });
    setSurveyDlg(true);
  };

  const surveys = q.data?.surveys ?? [];
  const responses = q.data?.responses ?? [];
  const overall = q.data?.overall;
  const bySurvey = q.data?.bySurvey ?? {};

  const recentComments = useMemo(
    () => responses.filter((r: any) => r.comment).slice(0, 10),
    [responses],
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Smile className="w-6 h-6" /> Pesquisas (NPS/CSAT)</h1>
          <p className="text-sm text-muted-foreground">Meça satisfação e indicação de clientes.</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> Nova pesquisa</Button>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">NPS Geral</div>
              <div className={`text-3xl font-semibold ${(overall?.nps ?? 0) >= 50 ? "text-green-600" : (overall?.nps ?? 0) >= 0 ? "text-amber-600" : "text-destructive"}`}>{overall?.nps ?? 0}</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Promotores</div>
              <div className="text-2xl font-semibold">{overall?.promoters ?? 0}</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3" /> Neutros</div>
              <div className="text-2xl font-semibold">{overall?.passives ?? 0}</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Detratores</div>
              <div className="text-2xl font-semibold">{overall?.detractors ?? 0}</div>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total / Média</div>
              <div className="text-2xl font-semibold">{overall?.total ?? 0}</div>
              <div className="text-xs text-muted-foreground">Nota média: {overall?.avg ?? 0}</div>
            </CardContent></Card>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="overview">Pesquisas</TabsTrigger>
              <TabsTrigger value="responses">Respostas</TabsTrigger>
              <TabsTrigger value="comments">Comentários</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-2">
              {surveys.length === 0 ? (
                <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhuma pesquisa criada.</CardContent></Card>
              ) : surveys.map((s: any) => {
                const m = bySurvey[s.id] ?? {};
                return (
                  <Card key={s.id}><CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium">{s.name}</div>
                        <Badge variant="outline">{TYPE_LABEL[s.type] ?? s.type}</Badge>
                        {s.active ? <Badge>Ativa</Badge> : <Badge variant="secondary">Inativa</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{s.question}</div>
                      <div className="text-xs mt-1 flex gap-3 text-muted-foreground">
                        <span>NPS: <b className="text-foreground">{m.nps ?? 0}</b></span>
                        <span>Respostas: {m.total ?? 0}</span>
                        <span>Média: {m.avg ?? 0}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => { setRespDlg(s); setRespDraft({ score: "9", comment: "", respondent_name: "", respondent_email: "" }); }}>
                        <MessageSquarePlus className="w-4 h-4 mr-1" /> Registrar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover pesquisa e todas as respostas?")) del.mutate(s.id); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent></Card>
                );
              })}
            </TabsContent>

            <TabsContent value="responses">
              <Card><CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <th className="p-2">Data</th><th className="p-2">Pesquisa</th><th className="p-2">Nota</th>
                      <th className="p-2">Categoria</th><th className="p-2">Respondente</th><th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.length === 0 ? (
                      <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sem respostas</td></tr>
                    ) : responses.map((r: any) => {
                      const surveyName = surveys.find((s: any) => s.id === r.survey_id)?.name ?? "—";
                      const b = scoreBadge(r.score);
                      return (
                        <tr key={r.id} className="border-t">
                          <td className="p-2 whitespace-nowrap">{new Date(r.responded_at).toLocaleDateString("pt-BR")}</td>
                          <td className="p-2">{surveyName}</td>
                          <td className="p-2 font-semibold">{r.score}</td>
                          <td className="p-2"><Badge variant={b.variant}>{b.label}</Badge></td>
                          <td className="p-2 text-muted-foreground">{r.respondent_name || r.respondent_email || "—"}</td>
                          <td className="p-2 text-right">
                            <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir resposta?")) delResp.mutate(r.id); }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="comments" className="space-y-2">
              {recentComments.length === 0 ? (
                <Card><CardContent className="p-6 text-sm text-muted-foreground">Sem comentários ainda.</CardContent></Card>
              ) : recentComments.map((r: any) => {
                const b = scoreBadge(r.score);
                return (
                  <Card key={r.id}><CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={b.variant}>{b.label} · {r.score}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(r.responded_at).toLocaleDateString("pt-BR")}</span>
                      <span className="text-xs text-muted-foreground">{r.respondent_name || r.respondent_email || ""}</span>
                    </div>
                    <p className="text-sm">{r.comment}</p>
                  </CardContent></Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Survey dialog */}
      <Dialog open={surveyDlg} onOpenChange={setSurveyDlg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar pesquisa" : "Nova pesquisa"}</DialogTitle>
            <DialogDescription>Configure tipo, pergunta e status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nps">NPS</SelectItem>
                    <SelectItem value="csat">CSAT</SelectItem>
                    <SelectItem value="ces">CES</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={draft.active ? "1" : "0"} onValueChange={(v) => setDraft({ ...draft, active: v === "1" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Ativa</SelectItem>
                    <SelectItem value="0">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Pergunta</Label>
              <Textarea value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSurveyDlg(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate({ ...draft, id: editId ?? undefined, organization_id: orgId })}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Response dialog */}
      <Dialog open={!!respDlg} onOpenChange={(o) => !o && setRespDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar resposta</DialogTitle>
            <DialogDescription>{respDlg?.question}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nota (0-10)</Label>
              <Input type="number" min={0} max={10} value={respDraft.score} onChange={(e) => setRespDraft({ ...respDraft, score: e.target.value })} />
            </div>
            <div>
              <Label>Comentário</Label>
              <Textarea value={respDraft.comment} onChange={(e) => setRespDraft({ ...respDraft, comment: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Nome</Label>
                <Input value={respDraft.respondent_name} onChange={(e) => setRespDraft({ ...respDraft, respondent_name: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={respDraft.respondent_email} onChange={(e) => setRespDraft({ ...respDraft, respondent_email: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRespDlg(null)}>Cancelar</Button>
            <Button onClick={() => record.mutate({
              organization_id: orgId,
              survey_id: respDlg.id,
              score: Number(respDraft.score),
              comment: respDraft.comment || null,
              respondent_name: respDraft.respondent_name || null,
              respondent_email: respDraft.respondent_email || null,
            })}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
