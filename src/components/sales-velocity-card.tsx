import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSalesVelocity } from "@/lib/sales-velocity.functions";

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

/**
 * Sales Velocity Card — mostra R$/dia que o pipeline produz, quebrando
 * os 4 componentes da fórmula clássica: # opps · ticket médio · win rate ÷ ciclo.
 * Compara com janela anterior de mesmo tamanho.
 */
export function SalesVelocityCard({ orgId, windowDays = 90 }: { orgId?: string; windowDays?: number }) {
  const fn = useServerFn(getSalesVelocity);
  const q = useQuery({
    queryKey: ["sales-velocity", orgId, windowDays],
    enabled: !!orgId,
    queryFn: () => fn({ data: { organization_id: orgId!, window_days: windowDays } }),
    staleTime: 5 * 60_000,
  });

  if (q.isLoading || !q.data) {
    return <Card className="p-4"><Skeleton className="h-28" /></Card>;
  }
  const d = q.data;
  const delta = d.delta_pct;
  const deltaIcon = delta == null ? Minus : delta >= 0 ? TrendingUp : TrendingDown;
  const DeltaIcon = deltaIcon;
  const deltaClass = delta == null
    ? "text-muted-foreground"
    : delta >= 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Gauge className="h-4 w-4 text-primary" />
          Sales Velocity
          <span className="text-xs font-normal text-muted-foreground">últimos {d.window_days}d</span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${deltaClass}`}>
          <DeltaIcon className="h-3.5 w-3.5" />
          {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`}
        </div>
      </div>

      <div>
        <div className="text-3xl font-bold tracking-tight">{brl(d.velocity_per_day)}</div>
        <div className="text-xs text-muted-foreground">por dia · velocidade do pipeline</div>
      </div>

      <div className="grid grid-cols-4 gap-2 border-t pt-3 text-xs">
        <VelMetric label="Opps" value={d.opportunities.toLocaleString("pt-BR")} />
        <VelMetric label="Ticket" value={brl(d.avg_deal_value)} />
        <VelMetric label="Win" value={`${(d.win_rate * 100).toFixed(0)}%`} />
        <VelMetric label="Ciclo" value={d.cycle_days ? `${Math.round(d.cycle_days)}d` : "—"} />
      </div>

      <p className="text-[10px] text-muted-foreground leading-tight">
        Fórmula: (opps × ticket × win rate) ÷ ciclo. Compara com os {d.window_days}d anteriores.
      </p>
    </Card>
  );
}

function VelMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold text-foreground truncate">{value}</div>
    </div>
  );
}
