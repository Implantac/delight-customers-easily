import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getRepsOverview, type RepRow } from "@/lib/reps.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toCSV, downloadCSV } from "@/lib/csv-export";
import {
  Award, Target, TrendingUp, TrendingDown, AlertTriangle, Activity,
  Flame, ArrowRight, MapPin, Compass, Download,
} from "lucide-react";

export const Route = createFileRoute("/_app/representantes")({
  component: RepsPage,
});

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function statusBadge(s: RepRow["status"]) {
  if (s === "ahead") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">acima da meta</Badge>;
  if (s === "on_track") return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/20">no ritmo</Badge>;
  if (s === "behind") return <Badge variant="destructive">atrasado</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">sem meta</Badge>;
}

function RepsPage() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(getRepsOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["reps-overview", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
  });

  const exportCsv = () => {
    const rows = data?.rows ?? [];
    if (rows.length === 0) return;
    const csv = toCSV(rows as any, [
      { key: "user_name", label: "Representante" },
      { key: "status", label: "Status" },
      { key: "target", label: "Meta" },
      { key: "achieved", label: "Realizado" },
      { key: "attainment", label: "% Meta" },
      { key: "open_value", label: "Pipeline aberto" },
      { key: "weighted_pipeline", label: "Pipeline ponderado" },
      { key: "coverage", label: "Cobertura" },
      { key: "deals_open", label: "Deals abertos" },
      { key: "deals_won_month", label: "Ganhos no mês" },
      { key: "stalled_count", label: "Deals parados" },
      { key: "activities_7d", label: "Atividades 7d" },
      { key: "last_activity_at", label: "Última atividade" },
    ]);
    downloadCSV(`representantes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe de Vendas"
        subtitle="Quem está acima, quem está atrás e quem precisa de ajuda hoje."
        icon={Award}
        action={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data || data.rows.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi loading={isLoading} label="Reps ativos" value={data?.summary.reps ?? 0} icon={Award} />
        <Kpi loading={isLoading} label="Meta total" value={data ? fmt(data.summary.target_total) : "—"} icon={Target} />
        <Kpi loading={isLoading} label="Realizado" value={data ? fmt(data.summary.achieved_total) : "—"} icon={TrendingUp} tone="ok" />
        <Kpi loading={isLoading} label="Atrás da meta" value={data?.summary.behind ?? 0} icon={TrendingDown} tone="danger" />
        <Kpi loading={isLoading} label="Deals parados" value={data?.summary.stalled_total ?? 0} icon={AlertTriangle} tone="warn" />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : !data || data.rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhum representante encontrado. Convide membros para começar.
        </Card>
      ) : (
        <div className="space-y-3">
          {[...data.rows]
            .sort((a, b) => b.attainment - a.attainment)
            .map((r, i) => <RepCard key={r.user_id} r={r} rank={i + 1} />)}
        </div>
      )}
    </div>
  );
}

function RepCard({ r, rank }: { r: RepRow; rank: number }) {
  const progressPct = Math.min(100, Math.round(r.attainment));
  const medal = rank === 1 ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
    : rank === 2 ? "bg-zinc-400/15 text-zinc-600 border-zinc-400/30"
    : rank === 3 ? "bg-orange-700/15 text-orange-700 border-orange-700/30"
    : "bg-muted text-muted-foreground border-border";
  return (
    <Card className="p-4">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
        <div className="min-w-0 lg:w-64 flex items-start gap-3">
          <div className={`h-9 w-9 shrink-0 rounded-full border flex items-center justify-center text-sm font-bold ${medal}`}>
            #{rank}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="font-semibold truncate">{r.user_name}</div>
              {statusBadge(r.status)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {r.deals_open} deals abertos · {r.deals_won_month} ganhos no mês
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between text-xs mb-1">
            <span>
              <span className="font-mono">{fmt(r.achieved)}</span>
              <span className="text-muted-foreground"> / {fmt(r.target)}</span>
            </span>
            <span className={r.attainment >= 100 ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
              {Math.round(r.attainment)}%
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span>Pipeline: <span className="text-foreground font-mono">{fmt(r.open_value)}</span></span>
            <span>Ponderado: <span className="text-foreground font-mono">{fmt(r.weighted_pipeline)}</span></span>
            <span>Cobertura: <span className={`font-mono ${r.coverage >= 3 ? "text-emerald-600" : r.coverage >= 1.5 ? "text-amber-600" : "text-destructive"}`}>{r.coverage >= 999 ? "∞" : `${r.coverage.toFixed(1)}x`}</span></span>
            <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" />{r.activities_7d}/7d</span>
            {r.stalled_count > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <AlertTriangle className="h-3 w-3" />{r.stalled_count} parados
              </span>
            )}
          </div>
        </div>

        <div className="lg:w-72 space-y-2">
          {r.hottest_deal ? (
            <div className="rounded-md border bg-muted/30 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Flame className="h-3 w-3" /> Top deal aberto
              </div>
              <div className="text-sm font-medium truncate">{r.hottest_deal.title}</div>
              <div className="text-xs font-mono">{fmt(r.hottest_deal.value)}</div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">Sem deals abertos</div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button asChild size="sm" variant="secondary" className="gap-1">
              <Link to="/coaching"><Compass className="h-3 w-3" />Coaching</Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="gap-1">
              <Link to="/geo"><MapPin className="h-3 w-3" />Rota</Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="gap-1">
              <Link to="/pipeline">Pipeline <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Kpi({
  label, value, icon: Icon, tone, loading,
}: {
  label: string; value: string | number; icon: typeof Award;
  tone?: "ok" | "warn" | "danger"; loading?: boolean;
}) {
  const color =
    tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-amber-600"
    : tone === "ok" ? "text-emerald-600"
    : "text-primary";
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <div className={`text-xl font-semibold mt-1 ${color}`}>{value}</div>}
    </Card>
  );
}
