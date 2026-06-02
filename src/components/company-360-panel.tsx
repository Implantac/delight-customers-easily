import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getCustomer360 } from "@/lib/customer360.functions";

const SEGMENT_LABEL: Record<string, string> = {
  campeoes: "Campeão",
  fieis: "Fiel",
  potencial: "Potencial",
  novos: "Novo",
  em_risco: "Em risco",
  hibernando: "Hibernando",
  perdidos: "Perdido",
};

const SEGMENT_COLORS: Record<string, string> = {
  campeoes: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  fieis: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  potencial: "bg-violet-500/15 text-violet-700 border-violet-500/30",
  novos: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30",
  em_risco: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  hibernando: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  perdidos: "bg-red-500/15 text-red-700 border-red-500/30",
};

const fmtBRL = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(n));

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

/**
 * Painel Customer 360 dentro da página da Empresa.
 * Mostra o snapshot consolidado (RFM, frequência, pipeline, etc.) para esta empresa.
 */
export function Company360Panel({
  organizationId,
  companyId,
}: {
  organizationId: string;
  companyId: string;
}) {
  const getFn = useServerFn(getCustomer360);
  const q = useQuery({
    queryKey: ["company-360", organizationId, companyId],
    enabled: !!organizationId && !!companyId,
    queryFn: () => getFn({ data: { organizationId, companyId } }),
    staleTime: 5 * 60_000,
  });

  if (q.isLoading) {
    return (
      <Card className="p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  const snap = q.data?.snapshot;
  if (!snap) {
    return (
      <Card className="p-5 border-dashed">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Customer 360
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Sem snapshot consolidado ainda para esta empresa. Recalcule em{" "}
          <a href="/customer-360" className="underline">Customer 360</a>.
        </p>
      </Card>
    );
  }

  const segKey = snap.rfm_segment ?? "";
  const segCls = SEGMENT_COLORS[segKey] ?? "bg-muted text-muted-foreground border-muted";
  const segLbl = SEGMENT_LABEL[segKey] ?? snap.rfm_segment ?? "—";
  const TrendIcon = snap.trend === "up" ? TrendingUp : snap.trend === "down" ? TrendingDown : Minus;
  const trendCls = snap.trend === "up" ? "text-emerald-600" : snap.trend === "down" ? "text-red-600" : "text-muted-foreground";

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Customer 360
        </h3>
        <div className="flex items-center gap-2">
          {snap.rfm_segment && (
            <Badge variant="outline" className={segCls}>{segLbl}</Badge>
          )}
          <span className={`inline-flex items-center gap-0.5 text-xs ${trendCls}`}>
            <TrendIcon className="h-3 w-3" />
            {snap.trend === "up" ? "subindo" : snap.trend === "down" ? "caindo" : "estável"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        <Metric label="Faturamento 12m" value={fmtBRL(snap.monetary)} />
        <Metric label="Frequência" value={`${snap.frequency ?? 0}×`} />
        <Metric label="Última compra" value={fmtDate(snap.last_purchase_at)} />
        <Metric label="Pipeline aberto" value={fmtBRL(snap.open_deals_value)} sub={`${snap.open_deals_count ?? 0} oport.`} />
        <Metric label="Ganhos 12m" value={fmtBRL(snap.won_deals_value_365d)} sub={`${snap.won_deals_count_365d ?? 0} fechados`} />
        <Metric label="Atividades 30d" value={`${snap.activities_30d ?? 0}`} sub={snap.last_activity_at ? `últ. ${fmtDate(snap.last_activity_at)}` : "sem atividade"} />
      </div>

      {snap.updated_at && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          Snapshot atualizado em {new Date(snap.updated_at).toLocaleString("pt-BR")}
        </p>
      )}
    </Card>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
