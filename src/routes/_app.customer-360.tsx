import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { listCustomer360, refreshCustomer360 } from "@/lib/customer360.functions";
import { whatsappLink } from "@/lib/wa";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, Search, RefreshCw, MessageSquare, Mail, Phone,
  TrendingUp, TrendingDown, Minus, Building, ExternalLink,
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

function Customer360Page() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const listFn = useServerFn(listCustomer360);
  const refreshFn = useServerFn(refreshCustomer360);

  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<string>("");
  const [sort, setSort] = useState<"monetary" | "recency" | "open_value">("monetary");

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
          <div className="text-xs text-muted-foreground px-1">{q.data?.total ?? items.length} clientes</div>
          {items.map((c: any) => {
            const segCls = SEGMENT_COLORS[c.rfm_segment] ?? "bg-muted text-muted-foreground border-muted";
            const segLbl = SEGMENT_LABEL[c.rfm_segment] ?? c.rfm_segment ?? "—";
            const wa = c.primary_phone ? whatsappLink(c.primary_phone) : null;
            const TrendIcon = c.trend === "up" ? TrendingUp : c.trend === "down" ? TrendingDown : Minus;
            const trendCls = c.trend === "up" ? "text-emerald-600" : c.trend === "down" ? "text-red-600" : "text-muted-foreground";
            return (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{c.display_name ?? "Sem nome"}</span>
                        {c.rfm_segment && (
                          <Badge variant="outline" className={segCls}>{segLbl}</Badge>
                        )}
                        <span className={`inline-flex items-center gap-0.5 text-xs ${trendCls}`}>
                          <TrendIcon className="h-3 w-3" />
                          {c.trend === "up" ? "subindo" : c.trend === "down" ? "caindo" : "estável"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {c.cnpj && <span>CNPJ {c.cnpj}</span>}
                        {c.primary_email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.primary_email}</span>}
                        {c.primary_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.primary_phone}</span>}
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
