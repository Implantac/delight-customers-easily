import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, Plus, Send, Trash2, Pencil, Users, Eye, MousePointerClick, AlertTriangle, Calendar } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import {
  listCampaigns, upsertCampaign, scheduleCampaign, populateRecipients,
  sendCampaignNow, recordEngagement, getCampaignDetail, deleteCampaign,
} from "@/lib/campaigns.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/campaigns")({ component: CampaignsPage });

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", scheduled: "Agendada", sending: "Enviando",
  sent: "Enviada", paused: "Pausada",
};
const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline", scheduled: "secondary", sending: "secondary",
  sent: "default", paused: "outline",
};
const RECIP_LABEL: Record<string, string> = {
  pending: "Pendente", sent: "Enviado", opened: "Aberto",
  clicked: "Clicou", bounced: "Bounce", unsubscribed: "Descadastrou",
};

function emptyDraft() {
  return {
    id: undefined as string | undefined,
    name: "",
    subject: "",
    preheader: "",
    from_name: "CRM",
    from_email: "",
    reply_to: "",
    body_html: "",
    scheduled_at: "",
    tags: "" as string,
  };
}

function CampaignsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const fetchFn = useServerFn(listCampaigns);
  const upsertFn = useServerFn(upsertCampaign);
  const scheduleFn = useServerFn(scheduleCampaign);
  const populateFn = useServerFn(populateRecipients);
  const sendFn = useServerFn(sendCampaignNow);
  const engageFn = useServerFn(recordEngagement);
  const detailFn = useServerFn(getCampaignDetail);
  const delFn = useServerFn(deleteCampaign);

  const [filter, setFilter] = useState<string>("all");
  const [editDlg, setEditDlg] = useState(false);
  const [draft, setDraft] = useState(emptyDraft());
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", orgId, filter],
    enabled: !!orgId,
    queryFn: () => fetchFn({ data: { organization_id: orgId!, status: filter } }),
  });

  const { data: detail } = useQuery({
    queryKey: ["campaign-detail", detailId],
    enabled: !!detailId,
    queryFn: () => detailFn({ data: { id: detailId! } }),
  });

  const upsert = useMutation({
    mutationFn: () => upsertFn({
      data: {
        id: draft.id,
        organization_id: orgId!,
        name: draft.name.trim(),
        subject: draft.subject.trim(),
        preheader: draft.preheader?.trim() || null,
        from_name: draft.from_name.trim() || "CRM",
        from_email: draft.from_email.trim(),
        reply_to: draft.reply_to?.trim() || null,
        body_html: draft.body_html,
        scheduled_at: draft.scheduled_at || null,
        tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      },
    }),
    onSuccess: () => { toast.success("Salvo"); setEditDlg(false); qc.invalidateQueries({ queryKey: ["campaigns"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const populate = useMutation({
    mutationFn: (id: string) => populateFn({ data: { organization_id: orgId!, campaign_id: id } }),
    onSuccess: (r) => { toast.success(`${r.added} destinatário(s) adicionado(s) — total ${r.total}`); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const sendNow = useMutation({
    mutationFn: (id: string) => sendFn({ data: { id } }),
    onSuccess: () => { toast.success("Campanha enfileirada — o disparo começa no próximo tick."); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const schedule = useMutation({
    mutationFn: (v: { id: string; when: string }) => scheduleFn({ data: { id: v.id, scheduled_at: v.when } }),
    onSuccess: () => { toast.success("Agendada"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const engage = useMutation({
    mutationFn: (v: { recipient_id: string; event: any }) => engageFn({ data: v }),
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluída"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setDraft(emptyDraft()); setEditDlg(true); };
  const openEdit = (c: any) => {
    setDraft({
      id: c.id,
      name: c.name,
      subject: c.subject,
      preheader: c.preheader ?? "",
      from_name: c.from_name,
      from_email: c.from_email,
      reply_to: c.reply_to ?? "",
      body_html: c.body_html ?? "",
      scheduled_at: c.scheduled_at ? c.scheduled_at.slice(0, 16) : "",
      tags: (c.tags ?? []).join(", "),
    });
    setEditDlg(true);
  };

  const totals = data?.totals ?? { draft: 0, scheduled: 0, sending: 0, sent: 0, recipients: 0, opened: 0, clicked: 0 };
  const openRate = totals.recipients ? Math.round((totals.opened / totals.recipients) * 100) : 0;
  const clickRate = totals.recipients ? Math.round((totals.clicked / totals.recipients) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Mail}
        title="Campanhas de Email"
        subtitle="Crie, agende e meça campanhas para seus contatos — segmente, personalize e acompanhe a taxa de abertura."
        action={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova campanha</Button>}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Enviadas</p>
          <p className="text-2xl font-bold">{totals.sent}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Destinatários</p>
          <p className="text-2xl font-bold">{totals.recipients}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Taxa de abertura</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{openRate}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Taxa de clique</p>
          <p className="text-2xl font-bold text-primary">{clickRate}%</p>
        </CardContent></Card>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="draft">Rascunho</TabsTrigger>
          <TabsTrigger value="scheduled">Agendadas</TabsTrigger>
          <TabsTrigger value="sent">Enviadas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (data?.campaigns ?? []).length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
          <Mail className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma campanha criada ainda.</p>
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0">
          <div className="divide-y">
            {(data?.campaigns ?? []).map((c: any) => {
              const openP = c.total_recipients ? Math.round((c.total_opened / c.total_recipients) * 100) : 0;
              const clickP = c.total_recipients ? Math.round((c.total_clicked / c.total_recipients) * 100) : 0;
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 hover:bg-accent/30 cursor-pointer"
                  onClick={() => setDetailId(c.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <Badge variant={STATUS_BADGE[c.status]} className="text-[10px]">{STATUS_LABEL[c.status]}</Badge>
                      {c.scheduled_at && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {new Date(c.scheduled_at).toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.subject}</p>
                    <div className="flex gap-4 mt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.total_recipients}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {openP}%</span>
                      <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {clickP}%</span>
                      {c.total_bounced > 0 && (
                        <span className="flex items-center gap-1 text-red-600"><AlertTriangle className="h-3 w-3" /> {c.total_bounced}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {c.status === "draft" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => populate.mutate(c.id)}>
                          <Users className="h-3 w-3 mr-1" /> Carregar
                        </Button>
                        <Button size="sm" variant="default"
                          onClick={() => sendNow.mutate(c.id)}
                          disabled={c.total_recipients === 0}>
                          <Send className="h-3 w-3 mr-1" /> Enviar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost"
                      onClick={() => { if (confirm("Excluir campanha?")) remove.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent></Card>
      )}

      {/* Edit dialog */}
      <Dialog open={editDlg} onOpenChange={setEditDlg}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar campanha" : "Nova campanha"}</DialogTitle>
            <DialogDescription>Defina o conteúdo do email e o agendamento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome interno</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Newsletter junho 2026" />
            </div>
            <div>
              <Label>Assunto</Label>
              <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="Novidades do mês 🎉" />
            </div>
            <div>
              <Label>Preheader (texto de prévia)</Label>
              <Input value={draft.preheader} onChange={(e) => setDraft({ ...draft, preheader: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>De (nome)</Label>
                <Input value={draft.from_name} onChange={(e) => setDraft({ ...draft, from_name: e.target.value })} />
              </div>
              <div>
                <Label>De (email)</Label>
                <Input type="email" value={draft.from_email}
                  onChange={(e) => setDraft({ ...draft, from_email: e.target.value })}
                  placeholder="news@empresa.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Responder para</Label>
                <Input type="email" value={draft.reply_to}
                  onChange={(e) => setDraft({ ...draft, reply_to: e.target.value })} />
              </div>
              <div>
                <Label>Agendar para</Label>
                <Input type="datetime-local" value={draft.scheduled_at}
                  onChange={(e) => setDraft({ ...draft, scheduled_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                placeholder="newsletter, junho" />
            </div>
            <div>
              <Label>Corpo (HTML)</Label>
              <Textarea rows={8} value={draft.body_html}
                onChange={(e) => setDraft({ ...draft, body_html: e.target.value })}
                placeholder="<h1>Olá!</h1><p>Confira as novidades...</p>" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDlg(false)}>Cancelar</Button>
            {draft.id && draft.scheduled_at && (
              <Button variant="secondary"
                onClick={() => schedule.mutate({ id: draft.id!, when: new Date(draft.scheduled_at).toISOString() })}>
                Agendar
              </Button>
            )}
            <Button disabled={!draft.name.trim() || !draft.subject.trim() || !draft.from_email.trim() || upsert.isPending}
              onClick={() => upsert.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detail?.campaign && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> {detail.campaign.name}</DialogTitle>
                <DialogDescription>
                  <Badge variant={STATUS_BADGE[detail.campaign.status]} className="mr-2">
                    {STATUS_LABEL[detail.campaign.status]}
                  </Badge>
                  {detail.campaign.subject}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 md:grid-cols-4 mb-3">
                <Card><CardContent className="p-3">
                  <p className="text-[11px] text-muted-foreground">Destinatários</p>
                  <p className="text-xl font-bold">{detail.campaign.total_recipients}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-[11px] text-muted-foreground">Abertos</p>
                  <p className="text-xl font-bold text-emerald-600">{detail.campaign.total_opened}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-[11px] text-muted-foreground">Cliques</p>
                  <p className="text-xl font-bold text-primary">{detail.campaign.total_clicked}</p>
                </CardContent></Card>
                <Card><CardContent className="p-3">
                  <p className="text-[11px] text-muted-foreground">Bounce / Descad.</p>
                  <p className="text-xl font-bold text-red-600">
                    {detail.campaign.total_bounced + detail.campaign.total_unsubscribed}
                  </p>
                </CardContent></Card>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Destinatários ({detail.recipients.length})</Label>
                <div className="mt-2 border rounded-md divide-y max-h-80 overflow-y-auto">
                  {detail.recipients.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground text-center">Nenhum destinatário ainda.</p>
                  ) : detail.recipients.map((r: any) => (
                    <div key={r.id} className="p-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.name || r.email}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{r.email}</p>
                      </div>
                      <Badge variant={r.status === "clicked" || r.status === "opened" ? "default"
                        : r.status === "bounced" || r.status === "unsubscribed" ? "destructive" : "outline"}
                        className="text-[10px]">{RECIP_LABEL[r.status]}</Badge>
                      {detail.campaign.status === "sent" && r.status === "sent" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost"
                            onClick={() => engage.mutate({ recipient_id: r.id, event: "opened" })}>
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => engage.mutate({ recipient_id: r.id, event: "clicked" })}>
                            <MousePointerClick className="h-3 w-3 text-primary" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => engage.mutate({ recipient_id: r.id, event: "bounced" })}>
                            <AlertTriangle className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
