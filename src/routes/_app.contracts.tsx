import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  FileSignature, Plus, Pencil, Trash2, Send, CheckCircle2, RefreshCw, XCircle,
  StickyNote, Calendar, ExternalLink, Building2,
} from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  listContracts, upsertContract, deleteContract, getContract, addContractEvent,
} from "@/lib/contracts.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ErpReadOnlyBanner } from "@/components/erp-readonly-banner";

export const Route = createFileRoute("/_app/contracts")({ component: ContractsPage });

const TYPE_LABEL: Record<string, string> = {
  sale: "Venda", nda: "NDA", msa: "MSA", sow: "SOW",
  renewal: "Renovação", partnership: "Parceria", other: "Outro",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", sent: "Enviado", active: "Ativo",
  expiring: "Expirando", ended: "Encerrado", cancelled: "Cancelado",
};
const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline", sent: "secondary", active: "default",
  expiring: "secondary", ended: "outline", cancelled: "destructive",
};
const EVENT_LABEL: Record<string, string> = {
  created: "Criado", sent: "Enviado", signed: "Assinado", amended: "Aditivo",
  renewed: "Renovado", cancelled: "Cancelado", ended: "Encerrado", note: "Anotação",
};

const fmtBRL = (v: number, ccy = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: ccy }).format(v);

function emptyDraft() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    number: `C-${Date.now().toString().slice(-6)}`,
    title: "",
    description: "",
    type: "sale" as const,
    status: "draft" as const,
    company_id: null as string | null,
    contact_id: null as string | null,
    owner_id: null as string | null,
    amount: 0,
    currency: "BRL",
    start_date: today,
    end_date: "",
    signed_at: "",
    renewal_alert_days: 30,
    auto_renew: false,
    document_url: "",
    notes: "",
  };
}

function ContractsPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const fetchFn = useServerFn(listContracts);
  const upsertFn = useServerFn(upsertContract);
  const delFn = useServerFn(deleteContract);
  const detailFn = useServerFn(getContract);
  const eventFn = useServerFn(addContractEvent);

  const [statusFilter, setStatusFilter] = useState<any>("all");
  const [editDlg, setEditDlg] = useState(false);
  const [draft, setDraft] = useState<any>(emptyDraft());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [eventDlg, setEventDlg] = useState<{ type: string; description: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["contracts", orgId, statusFilter],
    enabled: !!orgId,
    queryFn: () => fetchFn({ data: { organization_id: orgId!, status: statusFilter } }),
  });

  const { data: detail } = useQuery({
    queryKey: ["contract", detailId],
    enabled: !!detailId,
    queryFn: () => detailFn({ data: { id: detailId! } }),
  });

  const { data: companies } = useQuery({
    queryKey: ["companies-min", orgId],
    enabled: !!orgId && editDlg,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies").select("id, name").eq("organization_id", orgId!).order("name").limit(500);
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: draft.id,
          organization_id: orgId!,
          number: draft.number.trim(),
          title: draft.title.trim(),
          description: draft.description?.trim() || null,
          type: draft.type,
          status: draft.status,
          company_id: draft.company_id,
          contact_id: draft.contact_id,
          deal_id: null,
          owner_id: draft.owner_id,
          amount: Number(draft.amount) || null,
          currency: draft.currency || "BRL",
          start_date: draft.start_date || null,
          end_date: draft.end_date || null,
          signed_at: draft.signed_at || null,
          renewal_alert_days: Number(draft.renewal_alert_days) || 30,
          auto_renew: !!draft.auto_renew,
          document_url: draft.document_url?.trim() || null,
          notes: draft.notes?.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Contrato salvo");
      setEditDlg(false);
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["contracts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addEvent = useMutation({
    mutationFn: () =>
      eventFn({
        data: {
          organization_id: orgId!,
          contract_id: detailId!,
          event_type: eventDlg!.type as any,
          description: eventDlg!.description?.trim() || null,
          update_status: true,
        },
      }),
    onSuccess: () => {
      toast.success("Evento registrado");
      setEventDlg(null);
      qc.invalidateQueries({ queryKey: ["contract", detailId] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setDraft(emptyDraft()); setEditDlg(true); };
  const openEdit = (c: any) => {
    setDraft({
      ...c,
      description: c.description ?? "",
      amount: c.amount ?? 0,
      start_date: c.start_date ?? "",
      end_date: c.end_date ?? "",
      signed_at: c.signed_at ? c.signed_at.slice(0, 10) : "",
      document_url: c.document_url ?? "",
      notes: c.notes ?? "",
    });
    setEditDlg(true);
  };

  const totals = data?.totals ?? { active: 0, expiring: 0, draft: 0, ended: 0, totalValue: 0, expiringValue: 0 };

  return (
    <div className="space-y-6">
      <ErpReadOnlyBanner entity="Contratos" />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileSignature className="h-6 w-6" /> Contratos
          </h1>
          <p className="text-sm text-muted-foreground">Gestão de contratos, renovações e linha do tempo de eventos.</p>
        </div>
        {false && <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo contrato</Button>}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold">{totals.active}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Expirando em breve</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{totals.expiring}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Valor ativo</p>
          <p className="text-2xl font-bold">{fmtBRL(totals.totalValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Valor a renovar</p>
          <p className="text-2xl font-bold">{fmtBRL(totals.expiringValue)}</p>
        </CardContent></Card>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="draft">Rascunho</TabsTrigger>
          <TabsTrigger value="sent">Enviados</TabsTrigger>
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="expiring">Expirando</TabsTrigger>
          <TabsTrigger value="ended">Encerrados</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (data?.contracts ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <FileSignature className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhum contrato neste filtro.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {(data?.contracts ?? []).map((c) => {
                const daysLeft = c.end_date
                  ? Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000)
                  : null;
                const expiring = c.status === "active" && daysLeft !== null && daysLeft <= (c.renewal_alert_days ?? 30) && daysLeft >= 0;
                return (
                  <div key={c.id}
                    className="flex items-center gap-3 p-3 hover:bg-accent/30 cursor-pointer"
                    onClick={() => setDetailId(c.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{c.number}</span>
                        <p className="font-semibold text-sm truncate">{c.title}</p>
                        <Badge variant={STATUS_BADGE[c.status]} className="text-[10px]">
                          {STATUS_LABEL[c.status]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[c.type]}</Badge>
                        {expiring && (
                          <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                            Vence em {daysLeft}d
                          </Badge>
                        )}
                        {c.auto_renew && <Badge variant="outline" className="text-[10px]"><RefreshCw className="h-2.5 w-2.5 mr-0.5" /> Auto</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.start_date && <>de {new Date(c.start_date).toLocaleDateString("pt-BR")}</>}
                        {c.end_date && <> até {new Date(c.end_date).toLocaleDateString("pt-BR")}</>}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      {c.amount !== null && <p className="font-semibold">{fmtBRL(Number(c.amount), c.currency)}</p>}
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canManage && (
                        <Button size="sm" variant="ghost"
                          onClick={() => { if (confirm("Excluir contrato?")) remove.mutate(c.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={editDlg} onOpenChange={setEditDlg}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar contrato" : "Novo contrato"}</DialogTitle>
            <DialogDescription>Defina prazo, valor e renovação automática.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Número</Label>
                <Input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Título</Label>
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="MSA Empresa X" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Tipo</Label>
                <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Empresa</Label>
                <Select
                  value={draft.company_id ?? "__none__"}
                  onValueChange={(v) => setDraft({ ...draft, company_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nenhuma —</SelectItem>
                    {(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Valor</Label>
                <Input type="number" min={0} step="0.01"
                  value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              </div>
              <div>
                <Label>Moeda</Label>
                <Input value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} />
              </div>
              <div>
                <Label>Alerta renovação (dias)</Label>
                <Input type="number" min={0} max={365}
                  value={draft.renewal_alert_days}
                  onChange={(e) => setDraft({ ...draft, renewal_alert_days: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Início</Label>
                <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
              </div>
              <div>
                <Label>Assinado em</Label>
                <Input type="date" value={draft.signed_at} onChange={(e) => setDraft({ ...draft, signed_at: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={draft.auto_renew} onCheckedChange={(c) => setDraft({ ...draft, auto_renew: c })} />
              <Label>Renovação automática</Label>
            </div>
            <div>
              <Label>URL do documento</Label>
              <Input value={draft.document_url}
                onChange={(e) => setDraft({ ...draft, document_url: e.target.value })}
                placeholder="https://..." />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div>
              <Label>Notas internas</Label>
              <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDlg(false)}>Cancelar</Button>
            <Button disabled={!draft.title?.trim() || !draft.number?.trim() || upsert.isPending}
              onClick={() => upsert.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              {detail?.contract.number} — {detail?.contract.title}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={STATUS_BADGE[detail.contract.status]}>{STATUS_LABEL[detail.contract.status]}</Badge>
                <Badge variant="outline">{TYPE_LABEL[detail.contract.type]}</Badge>
                {detail.contract.amount !== null && (
                  <Badge variant="secondary">{fmtBRL(Number(detail.contract.amount), detail.contract.currency)}</Badge>
                )}
              </div>
              {detail.contract.description && (
                <p className="text-sm text-muted-foreground">{detail.contract.description}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {detail.contract.start_date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" /> Início: {new Date(detail.contract.start_date).toLocaleDateString("pt-BR")}
                  </div>
                )}
                {detail.contract.end_date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" /> Fim: {new Date(detail.contract.end_date).toLocaleDateString("pt-BR")}
                  </div>
                )}
                {detail.contract.signed_at && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4" /> Assinado: {new Date(detail.contract.signed_at).toLocaleDateString("pt-BR")}
                  </div>
                )}
                {detail.contract.document_url && (
                  <a href={detail.contract.document_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline">
                    <ExternalLink className="h-4 w-4" /> Ver documento
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEventDlg({ type: "sent", description: "" })}>
                  <Send className="h-3 w-3 mr-1" /> Marcar enviado
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEventDlg({ type: "signed", description: "" })}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Assinar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEventDlg({ type: "renewed", description: "" })}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Renovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEventDlg({ type: "amended", description: "" })}>
                  <StickyNote className="h-3 w-3 mr-1" /> Aditivo
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEventDlg({ type: "ended", description: "" })}>
                  Encerrar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEventDlg({ type: "cancelled", description: "" })}>
                  <XCircle className="h-3 w-3 mr-1" /> Cancelar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEventDlg({ type: "note", description: "" })}>
                  <StickyNote className="h-3 w-3 mr-1" /> Anotação
                </Button>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Linha do tempo</Label>
                <div className="mt-2 border rounded-md divide-y">
                  {detail.events.length === 0 ? (
                    <p className="p-3 text-sm text-center text-muted-foreground">Sem eventos.</p>
                  ) : detail.events.map((e) => (
                    <div key={e.id} className="p-2 text-sm flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">{EVENT_LABEL[e.event_type]}</Badge>
                      <div className="flex-1 min-w-0">
                        {e.description && <p>{e.description}</p>}
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(e.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Event dialog */}
      <Dialog open={!!eventDlg} onOpenChange={(o) => !o && setEventDlg(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{eventDlg && EVENT_LABEL[eventDlg.type]}</DialogTitle>
            <DialogDescription>Registra o evento e atualiza o status do contrato.</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} placeholder="Descrição (opcional)"
            value={eventDlg?.description ?? ""}
            onChange={(e) => setEventDlg({ ...eventDlg!, description: e.target.value })} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventDlg(null)}>Cancelar</Button>
            <Button disabled={addEvent.isPending} onClick={() => addEvent.mutate()}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
