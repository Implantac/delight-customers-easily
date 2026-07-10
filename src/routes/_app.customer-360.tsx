import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage, useIsManager } from "@/lib/permissions";
import { listCustomer360, refreshCustomer360, getCustomer360Timeline } from "@/lib/customer360.functions";
import { getCompanyErpStatus, type CompanyErpStatus } from "@/lib/erp-customer-status.functions";
import { Timeline, type TimelineItem } from "@/components/timeline";
import {
  bulkCreateActivityForCompanies,
  bulkAssignCompaniesOwner,
  bulkAddCompaniesToCampaign,
  bulkSendWhatsAppToCompanies,
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
  Clock, ChevronDown, ChevronUp,
} from "lucide-react";

export const Route = createFileRoute("/_app/customer-360")({
  component: Customer360Page,
  head: () => ({
    meta: [
      { title: "Customer 360 — USE PATRIUM" },
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
  const [quickFilter, setQuickFilter] = useState<"" | "vip" | "risk" | "stale7" | "openpipe">("");


  // Selection state — keyed by company_id (only companies can be acted upon)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<"activity" | "campaign" | "rep" | "whatsapp" | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  const rawItems = q.data?.items ?? [];
  const items = useMemo(() => {
    if (!quickFilter) return rawItems;
    const now = Date.now();
    return rawItems.filter((c: any) => {
      if (quickFilter === "vip") return c.rfm_segment === "campeoes" || c.rfm_segment === "fieis";
      if (quickFilter === "risk") return c.rfm_segment === "em_risco" || c.rfm_segment === "hibernando" || c.trend === "down";
      if (quickFilter === "openpipe") return (c.open_deals_count ?? 0) > 0;
      if (quickFilter === "stale7") {
        const ts = c.last_activity_at ? new Date(c.last_activity_at).getTime() : 0;
        return !ts || (now - ts) > 7 * 24 * 3600 * 1000;
      }
      return true;
    });
  }, [rawItems, quickFilter]);

  // Distribuição para a faixa de KPIs (sempre sobre a base sem quick-filter)
  const kpis = useMemo(() => {
    const now = Date.now();
    let vip = 0, risk = 0, stale = 0, open = 0, openValue = 0;
    for (const c of rawItems as any[]) {
      if (c.rfm_segment === "campeoes" || c.rfm_segment === "fieis") vip++;
      if (c.rfm_segment === "em_risco" || c.rfm_segment === "hibernando" || c.trend === "down") risk++;
      const ts = c.last_activity_at ? new Date(c.last_activity_at).getTime() : 0;
      if (!ts || now - ts > 7 * 24 * 3600 * 1000) stale++;
      if ((c.open_deals_count ?? 0) > 0) {
        open++;
        openValue += Number(c.open_deals_value ?? 0);
      }
    }
    return { total: rawItems.length, vip, risk, stale, open, openValue };
  }, [rawItems]);


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
    <div className="page-container max-w-[1400px]">
      <PageHeader
        icon={Users}
        title="Customer 360"
        subtitle="Visão consolidada de cada cliente — inteligência comercial e canais."
        action={
          <div className="flex items-center gap-2">
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshMut.mutate()}
                disabled={refreshMut.isPending}
                className="gap-2 h-9 px-4"
              >
                <RefreshCw className={`h-4 w-4 ${refreshMut.isPending ? "animate-spin" : ""}`} />
                Recalcular
              </Button>
            )}
            <Button variant="premium" size="sm" className="h-9 px-4">
              <TrendingUp className="mr-2 h-4 w-4" /> Novo insight
            </Button>
          </div>
        }
      />

      {/* Faixa de KPIs — distribuição da carteira, clicáveis */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { k: "", label: "Carteira", value: kpis.total.toLocaleString("pt-BR"), sub: "clientes", cls: "border-border/40" },
          { k: "vip", label: "⭐ VIP", value: kpis.vip.toLocaleString("pt-BR"), sub: "campeões + fiéis", cls: "border-emerald-500/30 bg-emerald-500/[0.04]" },
          { k: "risk", label: "⚠ Em risco", value: kpis.risk.toLocaleString("pt-BR"), sub: "requerem ação", cls: "border-amber-500/30 bg-amber-500/[0.04]" },
          { k: "stale7", label: "⏳ Sem follow-up 7d", value: kpis.stale.toLocaleString("pt-BR"), sub: "sem contato recente", cls: "border-rose-500/30 bg-rose-500/[0.04]" },
          { k: "openpipe", label: "📈 Pipeline aberto", value: kpis.open.toLocaleString("pt-BR"), sub: fmtBRL(kpis.openValue), cls: "border-primary/30 bg-primary/[0.04]" },
        ].map((k) => (
          <button
            key={k.k || "all"}
            onClick={() => setQuickFilter(k.k as any)}
            className={cn(
              "text-left rounded-lg border p-3 transition-all hover:shadow-md hover:-translate-y-0.5",
              k.cls,
              quickFilter === k.k && "ring-2 ring-current/30 shadow-md",
            )}
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{k.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{k.value}</div>
            <div className="text-[11px] text-muted-foreground truncate">{k.sub}</div>
          </button>
        ))}
      </div>

      <Card className="border-border/40 bg-card/50 shadow-sm mb-6">
        <CardContent className="p-3 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 border-border/60 bg-background/50 focus-visible:ring-primary/20"
            />
          </div>
          <Select value={segment || "all"} onValueChange={(v) => setSegment(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px] h-9 border-border/60 bg-background/50"><SelectValue placeholder="Segmento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os segmentos</SelectItem>
              {Object.entries(SEGMENT_LABEL).map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v: any) => setSort(v)}>
            <SelectTrigger className="w-[200px] h-9 border-border/60 bg-background/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monetary">Ordenar por: Faturamento</SelectItem>
              <SelectItem value="recency">Ordenar por: Última compra</SelectItem>
              <SelectItem value="open_value">Ordenar por: Pipeline aberto</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Chips de foco rápido — persona-driven, sem lógica de ERP */}
      <div className="flex flex-wrap items-center gap-2 mb-4 px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mr-1">Foco rápido:</span>
        {[
          { k: "", label: "Todos", cls: "bg-muted/40 text-foreground" },
          { k: "vip", label: "⭐ VIP", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
          { k: "risk", label: "⚠ Em risco", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
          { k: "stale7", label: "⏳ Sem follow-up 7d", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
          { k: "openpipe", label: "📈 Pipeline aberto", cls: "bg-primary/15 text-primary border-primary/30" },
        ].map((f) => (
          <button
            key={f.k || "all"}
            onClick={() => setQuickFilter(f.k as any)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-bold transition-all hover:scale-[1.03] hover:shadow-sm",
              quickFilter === f.k
                ? `${f.cls} border-current shadow-sm ring-2 ring-current/20`
                : "bg-muted/20 text-muted-foreground border-border/40 hover:bg-muted/40",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>




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
            <Button size="sm" variant="outline" onClick={() => setDialog("whatsapp")} className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> Disparo WhatsApp
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
        <Card className="border-border/40 shadow-sm"><CardContent className="p-8 text-sm text-muted-foreground">Carregando…</CardContent></Card>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-border/60 bg-muted/5">
          <CardContent className="p-12 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhum cliente consolidado</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Conecte um ERP em{" "}
              <Link to="/integrations" className="underline">Integrações</Link>{" "}
              e clique em <strong>Recalcular</strong> para gerar a visão 360.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 mb-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{q.data?.total ?? items.length} clientes</div>
            {allCompanyIds.length > 0 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer group">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                <span className="group-hover:text-foreground transition-colors">Selecionar todas as empresas visíveis</span>
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
              <Card key={c.id} className={cn(
                "hover-lift ring-brand-hover border-border/40 transition-all duration-300",
                checked ? "border-primary/40 bg-primary/[0.02] shadow-sm ring-1 ring-primary/20" : "bg-card shadow-xs"
              )}>
                <CardContent className="p-5">
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
                      {c.company_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleExpanded(c.company_id)}
                          className="gap-1"
                          aria-expanded={expanded.has(c.company_id)}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Timeline
                          {expanded.has(c.company_id)
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      )}
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

                  {c.company_id && expanded.has(c.company_id) && orgId && (
                    <div className="mt-4 pt-4 border-t border-border/40">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-primary" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Timeline omnichannel — últimos eventos
                        </h4>
                      </div>
                      <InlineTimeline orgId={orgId} companyId={c.company_id} />
                    </div>
                  )}
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
      {dialog === "whatsapp" && orgId && (
        <BulkWhatsAppDialog
          orgId={orgId}
          companyIds={selectedCompanyIds}
          onClose={() => setDialog(null)}
          onDone={onBulkDone}
        />
      )}
    </div>
  );
}

function BulkWhatsAppDialog({
  orgId, companyIds, onClose, onDone,
}: { orgId: string; companyIds: string[]; onClose: () => void; onDone: () => void }) {
  const fn = useServerFn(bulkSendWhatsAppToCompanies);
  const [body, setBody] = useState("Olá {name}, tudo bem? Posso te ajudar com algo hoje?");

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          organizationId: orgId,
          companyIds,
          body: body.trim(),
        },
      }),
    onSuccess: (r: any) => {
      if (r.queued === 0) {
        toast.warning(r.reason ?? "Nenhuma mensagem enfileirada");
      } else {
        toast.success(`${r.queued} mensagem(ns) enfileirada(s)${r.skipped ? ` · ${r.skipped} sem telefone` : ""}`);
        onDone();
      }
    },
    onError: (e: any) => toast.error("Falha", { description: e?.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disparo WhatsApp em massa</DialogTitle>
          <DialogDescription>
            Uma mensagem será enfileirada para cada empresa selecionada que tiver telefone.
            Use <code>{"{name}"}</code> para inserir o nome da empresa. Lembre-se da janela de 24h do WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="wa-body">Mensagem</Label>
          <Textarea
            id="wa-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={1500}
          />
          <div className="text-[11px] text-muted-foreground">
            {body.length}/1500 · {companyIds.length} destinatário(s) selecionado(s)
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!body.trim() || mut.isPending}>
            {mut.isPending ? "Enfileirando…" : `Enfileirar ${companyIds.length} envio(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

