import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage, useIsManager } from "@/lib/permissions";
import { listCustomer360, refreshCustomer360 } from "@/lib/customer360.functions";
import { getCompanyErpStatus, type CompanyErpStatus } from "@/lib/erp-customer-status.functions";
import {
  bulkCreateActivityForCompanies,
  bulkAssignCompaniesOwner,
  bulkAddCompaniesToCampaign,
} from "@/lib/customer360-bulk.functions";
import { listCampaigns } from "@/lib/campaigns.functions";
import { getRepsOverview } from "@/lib/reps.functions";
import { whatsappLink } from "@/lib/wa";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Users, Search, RefreshCw, MessageSquare, Mail, Phone,
  TrendingUp, TrendingDown, Minus, Building, ExternalLink,
  CalendarPlus, UserCog, Megaphone, X, Database, AlertTriangle, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_app/customer-360")({
  component: Customer360Page,
  head: () => ({
    meta: [
      { title: "Customer 360 — USE CRM" },
      { name: "description", content: "Visão consolidada de cada cliente: ERP, atividades, WhatsApp e IA." },
    ],
  }),
});

const SEGMENT_COLORS: Record<string, string> = {
  campeoes: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  fieis: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  potencial: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  novos: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
  em_risco: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  hibernando: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  perdidos: "bg-red-500/15 text-red-700 border-red-500/30",
};

const SEGMENT_LABEL: Record<string, string> = {
  campeoes: "Campeões",
  fieis: "Fiéis",
  potencial: "Potencial",
  novos: "Novos",
  em_risco: "Em risco",
  hibernando: "Hibernando",
  perdidos: "Perdidos",
};

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(v));
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

const NBA_BY_SEGMENT: Record<string, { label: string; cls: string }> = {
  campeoes: { label: "Oferecer upsell", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  fieis: { label: "Cross-sell", cls: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
  potencial: { label: "Agendar visita", cls: "bg-violet-500/10 text-violet-700 border-violet-500/30" },
  novos: { label: "Follow-up", cls: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30" },
  em_risco: { label: "Ligar hoje", cls: "bg-amber-500/15 text-amber-700 border-amber-500/40" },
  hibernando: { label: "Reativar c/ cupom", cls: "bg-orange-500/15 text-orange-700 border-orange-500/40" },
  perdidos: { label: "Win-back", cls: "bg-red-500/15 text-red-700 border-red-500/40" },
};

function Customer360Page() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const isManager = useIsManager();
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomer360);
  const refreshFn = useServerFn(refreshCustomer360);

  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<string>("");
  const [sort, setSort] = useState<"monetary" | "recency" | "open_value">("monetary");

  // Selection state — keyed by company_id (only companies can be acted upon)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<"activity" | "campaign" | "rep" | null>(null);

  const q = useQuery({
    queryKey: ["customer-360", orgId, search, segment, sort],
    queryFn: () =>
      listFn({
        data: {
          organizationId: orgId!,
          search: search || undefined,
          segment: segment || undefined,
          sort,
          limit: 100,
          offset: 0,
        },
      }),
    enabled: !!orgId,
  });

  const refreshMut = useMutation({
    mutationFn: () => refreshFn({ data: { organizationId: orgId! } }),
    onSuccess: (r) => {
      toast.success(`Snapshot recalculado (${r.affected} clientes)`);
      q.refetch();
    },
    onError: (e: any) => toast.error("Falha", { description: e?.message }),
  });

  const items = q.data?.items ?? [];

  // Per-company ERP sync status (last sync, conflicts) — shown as a chip in each row
  const visibleCompanyIds = useMemo(
    () => items.filter((c: any) => c.company_id).map((c: any) => c.company_id as string),
    [items],
  );
  const erpStatusFn = useServerFn(getCompanyErpStatus);
  const erpStatusQ = useQuery({
    queryKey: ["customer-360-erp-status", orgId, visibleCompanyIds.join(",")],
    queryFn: () =>
      erpStatusFn({
        data: { organization_id: orgId!, company_ids: visibleCompanyIds.slice(0, 200) },
      }),
    enabled: !!orgId && visibleCompanyIds.length > 0,
    staleTime: 30_000,
  });
  const erpStatusMap = useMemo(() => {
    const m = new Map<string, CompanyErpStatus>();
    for (const it of erpStatusQ.data?.items ?? []) m.set(it.company_id, it);
    return m;
  }, [erpStatusQ.data]);

  // company_ids selecionados (filtra apenas linhas que de fato têm company_id)
  const selectedCompanyIds = useMemo(
    () => items.filter((c: any) => c.company_id && selected.has(c.company_id)).map((c: any) => c.company_id as string),
    [items, selected],
  );

  const toggleOne = (companyId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  };

  const allCompanyIds = items.filter((c: any) => c.company_id).map((c: any) => c.company_id as string);
  const allSelected = allCompanyIds.length > 0 && allCompanyIds.every((id) => selected.has(id));
  const toggleAll = () => {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const id of allCompanyIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of allCompanyIds) next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const onBulkDone = () => {
    clearSelection();
    setDialog(null);
    qc.invalidateQueries({ queryKey: ["customer-360"] });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          icon={Users}
          title="Customer 360"
          subtitle="Visão consolidada por cliente — ERP, atividade comercial e canais."
        />
        {canManage && (
          <Button
            variant="outline"
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshMut.isPending ? "animate-spin" : ""}`} />
            Recalcular
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CNPJ"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={segment || "all"} onValueChange={(v) => setSegment(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Segmento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os segmentos</SelectItem>
              {Object.entries(SEGMENT_LABEL).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monetary">Ordenar por: Faturamento</SelectItem>
              <SelectItem value="recency">Ordenar por: Última compra</SelectItem>
              <SelectItem value="open_value">Ordenar por: Pipeline aberto</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Barra de ações em massa — aparece quando há seleção */}
      {selectedCompanyIds.length > 0 && (
        <Card className="border-primary/40 bg-primary/5 sticky top-2 z-10">
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium px-2">
              {selectedCompanyIds.length} empresa{selectedCompanyIds.length > 1 ? "s" : ""} selecionada{selectedCompanyIds.length > 1 ? "s" : ""}
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={() => setDialog("activity")} className="gap-1.5">
              <CalendarPlus className="h-3.5 w-3.5" /> Criar atividade
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog("campaign")} className="gap-1.5">
              <Megaphone className="h-3.5 w-3.5" /> Adicionar à campanha
            </Button>
            {isManager && (
              <Button size="sm" variant="outline" onClick={() => setDialog("rep")} className="gap-1.5">
                <UserCog className="h-3.5 w-3.5" /> Atribuir representante
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={clearSelection} className="gap-1">
              <X className="h-3.5 w-3.5" /> Limpar
            </Button>
          </CardContent>
        </Card>
      )}

      {q.isLoading ? (
        <Card><CardContent className="p-8 text-sm text-muted-foreground">Carregando…</CardContent></Card>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-2">
            <Users className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum cliente consolidado ainda. Conecte um ERP em{" "}
              <Link to="/integrations" className="underline">Integrações</Link>{" "}
              e clique em <strong>Recalcular</strong>.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="text-xs text-muted-foreground">{q.data?.total ?? items.length} clientes</div>
            {allCompanyIds.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                Selecionar todas as empresas visíveis
              </label>
            )}
          </div>

          {items.map((c: any) => {
            const segCls = SEGMENT_COLORS[c.rfm_segment] ?? "bg-muted text-muted-foreground border-muted";
            const segLbl = SEGMENT_LABEL[c.rfm_segment] ?? c.rfm_segment ?? "—";
            const wa = c.primary_phone ? whatsappLink(c.primary_phone) : null;
            const TrendIcon = c.trend === "up" ? TrendingUp : c.trend === "down" ? TrendingDown : Minus;
            const trendCls = c.trend === "up" ? "text-emerald-600" : c.trend === "down" ? "text-red-600" : "text-muted-foreground";
            const checked = c.company_id ? selected.has(c.company_id) : false;
            const erp = c.company_id ? erpStatusMap.get(c.company_id) : undefined;
            return (
              <Card key={c.id} className={checked ? "border-primary/40 bg-primary/5" : undefined}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1 flex items-start gap-3">
                      {c.company_id ? (
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(c.company_id)}
                          className="mt-1"
                          aria-label={`Selecionar ${c.display_name ?? "cliente"}`}
                        />
                      ) : (
                        <div className="w-4" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{c.display_name ?? "Sem nome"}</span>
                          {c.rfm_segment && (
                            <Badge variant="outline" className={segCls}>{segLbl}</Badge>
                          )}
                          {NBA_BY_SEGMENT[c.rfm_segment] && (
                            <Badge variant="outline" className={NBA_BY_SEGMENT[c.rfm_segment].cls} title="Próxima melhor ação sugerida">
                              ⚡ {NBA_BY_SEGMENT[c.rfm_segment].label}
                            </Badge>
                          )}
                          <span className={`inline-flex items-center gap-0.5 text-xs ${trendCls}`}>
                            <TrendIcon className="h-3 w-3" />
                            {c.trend === "up" ? "subindo" : c.trend === "down" ? "caindo" : "estável"}
                          </span>
                          <ErpSyncBadge erp={erp} />
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {c.cnpj && <span>CNPJ {c.cnpj}</span>}
                          {c.primary_email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.primary_email}</span>}
                          {c.primary_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.primary_phone}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {wa && (
                        <Button asChild variant="outline" size="sm" className="gap-1">
                          <a href={wa} target="_blank" rel="noopener noreferrer">
                            <MessageSquare className="h-3.5 w-3.5" />WhatsApp
                          </a>
                        </Button>
                      )}
                      {c.company_id && (
                        <Button asChild variant="ghost" size="sm" className="gap-1">
                          <Link to="/companies/$id" params={{ id: c.company_id }}>
                            Abrir <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
                    <Metric label="Faturamento 12m" value={fmtBRL(c.monetary)} accent />
                    <Metric label="Frequência" value={`${c.frequency ?? 0}×`} />
                    <Metric label="Última compra" value={fmtDate(c.last_purchase_at)} />
                    <Metric label="Pipeline aberto" value={fmtBRL(c.open_deals_value)} sub={`${c.open_deals_count ?? 0} oport.`} />
                    <Metric label="Ganhos 12m" value={fmtBRL(c.won_deals_value_365d)} sub={`${c.won_deals_count_365d ?? 0} fechados`} />
                    <Metric label="Atividades 30d" value={`${c.activities_30d ?? 0}`} sub={c.last_activity_at ? `últ. ${fmtDate(c.last_activity_at)}` : "sem atividade"} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Diálogos de ações em massa */}
      {dialog === "activity" && orgId && (
        <BulkActivityDialog
          orgId={orgId}
          companyIds={selectedCompanyIds}
          onClose={() => setDialog(null)}
          onDone={onBulkDone}
        />
      )}
      {dialog === "campaign" && orgId && (
        <BulkCampaignDialog
          orgId={orgId}
          companyIds={selectedCompanyIds}
          onClose={() => setDialog(null)}
          onDone={onBulkDone}
        />
      )}
      {dialog === "rep" && orgId && (
        <BulkRepDialog
          orgId={orgId}
          companyIds={selectedCompanyIds}
          onClose={() => setDialog(null)}
          onDone={onBulkDone}
        />
      )}
    </div>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium ${accent ? "text-foreground" : ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─────────── Diálogos ───────────

function BulkActivityDialog({
  orgId, companyIds, onClose, onDone,
}: { orgId: string; companyIds: string[]; onClose: () => void; onDone: () => void }) {
  const fn = useServerFn(bulkCreateActivityForCompanies);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"call" | "email" | "meeting" | "task" | "note">("task");
  const [dueDate, setDueDate] = useState<string>("");
  const [description, setDescription] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          organizationId: orgId,
          companyIds,
          title: title.trim(),
          type,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          description: description.trim() || undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(`${r.created} atividade(s) criada(s)`);
      onDone();
    },
    onError: (e: any) => toast.error("Falha", { description: e?.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar atividade em massa</DialogTitle>
          <DialogDescription>
            Uma atividade será criada para cada uma das {companyIds.length} empresas selecionadas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="b-title">Título</Label>
            <Input id="b-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ligar para revisar relacionamento" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="task">Tarefa</SelectItem>
                  <SelectItem value="note">Nota</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="b-date">Vencimento</Label>
              <Input id="b-date" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="b-desc">Descrição (opcional)</Label>
            <Textarea id="b-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!title.trim() || mut.isPending}>
            {mut.isPending ? "Criando…" : `Criar ${companyIds.length} atividade(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkCampaignDialog({
  orgId, companyIds, onClose, onDone,
}: { orgId: string; companyIds: string[]; onClose: () => void; onDone: () => void }) {
  const addFn = useServerFn(bulkAddCompaniesToCampaign);
  const listFn = useServerFn(listCampaigns);
  const [campaignId, setCampaignId] = useState("");

  const q = useQuery({
    queryKey: ["campaigns-for-bulk", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId } as any }),
  });

  const mut = useMutation({
    mutationFn: () =>
      addFn({
        data: { organizationId: orgId, companyIds, campaignId },
      }),
    onSuccess: (r: any) => {
      if (r.added === 0) {
        toast.info(r.reason ?? `Nenhum contato novo adicionado (${r.skipped} já existiam)`);
      } else {
        toast.success(`${r.added} contato(s) adicionado(s)${r.skipped ? ` · ${r.skipped} já existiam` : ""}`);
      }
      onDone();
    },
    onError: (e: any) => toast.error("Falha", { description: e?.message }),
  });

  const campaigns = (q.data as any)?.items ?? (q.data as any) ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar à campanha</DialogTitle>
          <DialogDescription>
            Todos os contatos com e-mail das {companyIds.length} empresas selecionadas serão adicionados como destinatários.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Campanha</Label>
          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger>
              <SelectValue placeholder={q.isLoading ? "Carregando…" : "Escolha uma campanha"} />
            </SelectTrigger>
            <SelectContent>
              {campaigns.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma campanha encontrada.</div>
              ) : (
                campaigns.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name ?? c.subject ?? c.id}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Crie campanhas em <Link to="/campaigns" className="underline">Campanhas</Link>.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!campaignId || mut.isPending}>
            {mut.isPending ? "Adicionando…" : "Adicionar destinatários"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkRepDialog({
  orgId, companyIds, onClose, onDone,
}: { orgId: string; companyIds: string[]; onClose: () => void; onDone: () => void }) {
  const assignFn = useServerFn(bulkAssignCompaniesOwner);
  const repsFn = useServerFn(getRepsOverview);
  const [userId, setUserId] = useState("");

  const q = useQuery({
    queryKey: ["reps-for-bulk", orgId],
    queryFn: () => repsFn({ data: { organization_id: orgId } }),
  });

  const mut = useMutation({
    mutationFn: () =>
      assignFn({
        data: { organizationId: orgId, companyIds, newOwnerId: userId },
      }),
    onSuccess: (r) => {
      toast.success(`${r.updated} empresa(s) reatribuída(s)`);
      onDone();
    },
    onError: (e: any) => toast.error("Falha", { description: e?.message }),
  });

  const reps = (q.data as any)?.reps ?? (q.data as any) ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir representante</DialogTitle>
          <DialogDescription>
            Define o responsável (owner) das {companyIds.length} empresas selecionadas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Representante</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger>
              <SelectValue placeholder={q.isLoading ? "Carregando…" : "Escolha um representante"} />
            </SelectTrigger>
            <SelectContent>
              {reps.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum representante encontrado.</div>
              ) : (
                reps.map((r: any) => (
                  <SelectItem key={r.user_id} value={r.user_id}>
                    {r.user_name ?? r.user_id}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!userId || mut.isPending}>
            {mut.isPending ? "Atribuindo…" : "Atribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ErpSyncBadge({ erp }: { erp?: CompanyErpStatus }) {
  if (!erp || !erp.synced_at) {
    return (
      <Badge variant="outline" className="gap-1 bg-muted text-muted-foreground border-muted">
        <Database className="h-3 w-3" /> sem ERP
      </Badge>
    );
  }
  const ageMs = Date.now() - new Date(erp.synced_at).getTime();
  const ageH = ageMs / 3_600_000;
  const stale = ageH > 24;
  const hasConflict = erp.open_conflicts > 0;
  const tone = hasConflict
    ? "bg-amber-500/15 text-amber-700 border-amber-500/30"
    : stale
    ? "bg-orange-500/15 text-orange-700 border-orange-500/30"
    : "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  const Icon = hasConflict ? AlertTriangle : stale ? Database : CheckCircle2;
  const label = hasConflict
    ? `${erp.open_conflicts} conflito${erp.open_conflicts > 1 ? "s" : ""}`
    : stale
    ? `ERP ${Math.round(ageH)}h`
    : `ERP ok`;
  const title = [
    erp.provider ? `Provider: ${erp.provider}` : null,
    erp.external_id ? `ext_id: ${erp.external_id}` : null,
    erp.synced_at ? `Última sync: ${new Date(erp.synced_at).toLocaleString("pt-BR")}` : null,
    erp.last_error ? `Último erro: ${erp.last_error}` : null,
  ].filter(Boolean).join(" • ");
  return (
    <Badge variant="outline" className={`gap-1 ${tone}`} title={title}>
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}

