import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getGroupBenchmark, type BenchmarkRow } from "@/lib/benchmark.functions";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  GitBranch, Trophy, AlertTriangle, TrendingUp, Users, Activity, ArrowRight, Layers,
  Building2, Scale,
} from "lucide-react";

export const Route = createFileRoute("/_app/benchmark")({
  component: BenchmarkPage,
});

type Mode = "individual" | "consolidado" | "comparativo";

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toFixed(1)}%`;

function BenchmarkPage() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(getGroupBenchmark);
  const [mode, setMode] = useState<Mode>("consolidado");
  const { data, isLoading } = useQuery({
    queryKey: ["benchmark", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });

  const rows = data?.rows ?? [];
  const currentRow = rows.find((r) => r.isCurrent) ?? null;
  const consolidated = rows.reduce(
    (acc, r) => {
      acc.wonRevenue90 += r.wonRevenue90;
      acc.openPipeline += r.openPipeline;
      acc.activeCustomers += r.activeCustomers;
      acc.activities30 += r.activities30;
      acc.overdue += r.overdue;
      return acc;
    },
    { wonRevenue90: 0, openPipeline: 0, activeCustomers: 0, activities30: 0, overdue: 0 },
  );

  // Líder por métrica (replicação de práticas)
  const leader = (key: keyof BenchmarkRow) =>
    rows.length ? [...rows].sort((a, b) => Number(b[key]) - Number(a[key]))[0] : null;
  const leaders = data && data.hasGroup ? {
    revenue: leader("wonRevenue90"),
    conversion: leader("conversion"),
    ticket: leader("ticketAvg"),
    activity: leader("activities30"),
  } : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Benchmark do grupo"
        subtitle="Compare unidades, identifique a melhor prática, replique no resto."
        icon={GitBranch}
      />

      {!isLoading && data && !data.hasGroup && (
        <Card className="p-6 border-dashed">
          <div className="flex items-start gap-3">
            <Layers className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Configure um grupo empresarial</div>
              <p className="text-sm text-muted-foreground mt-1">
                Esta organização ainda não faz parte de um grupo (holding → filiais).
                Vincule outras unidades em <Link to="/companies" className="underline">Grupos / Filiais</Link>{" "}
                definindo uma organização-mãe para começar a comparar performance.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="individual"><Building2 className="h-4 w-4 mr-1" />Individual</TabsTrigger>
          <TabsTrigger value="consolidado"><Layers className="h-4 w-4 mr-1" />Consolidado</TabsTrigger>
          <TabsTrigger value="comparativo" disabled={!data?.hasGroup}><Scale className="h-4 w-4 mr-1" />Comparativo</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-6 mt-4">
          {currentRow ? (
            <>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                Métricas da unidade atual: <span className="font-medium text-foreground">{currentRow.name}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPI loading={isLoading} label="Receita 30d" value={fmt(currentRow.wonRevenue30)} icon={TrendingUp} tone="ok" />
                <KPI loading={isLoading} label="Receita 90d" value={fmt(currentRow.wonRevenue90)} icon={TrendingUp} />
                <KPI loading={isLoading} label="Pipeline aberto" value={fmt(currentRow.openPipeline)} icon={Activity} />
                <KPI loading={isLoading} label="Em atraso" value={fmt(currentRow.overdue)} icon={AlertTriangle} tone={currentRow.overdue > 0 ? "danger" : "ok"} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPI loading={isLoading} label="Conversão" value={pct(currentRow.conversion)} icon={Trophy} />
                <KPI loading={isLoading} label="Ticket médio" value={fmt(currentRow.ticketAvg)} icon={TrendingUp} />
                <KPI loading={isLoading} label="Clientes ativos" value={currentRow.activeCustomers.toString()} icon={Users} />
                <KPI loading={isLoading} label="Atividades 30d" value={currentRow.activities30.toString()} icon={Activity} />
              </div>
            </>
          ) : (
            <Card className="p-6 text-sm text-muted-foreground">Carregando métricas da unidade…</Card>
          )}
        </TabsContent>

        <TabsContent value="consolidado" className="space-y-6 mt-4">
          <div className="text-sm text-muted-foreground">
            Soma de {rows.length} {rows.length === 1 ? "unidade" : "unidades"} do grupo.
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPI loading={isLoading} label="Receita 90d (consolidado)" value={fmt(consolidated.wonRevenue90)} icon={TrendingUp} tone="ok" />
            <KPI loading={isLoading} label="Pipeline aberto" value={fmt(consolidated.openPipeline)} icon={Activity} />
            <KPI loading={isLoading} label="Clientes ativos" value={consolidated.activeCustomers.toString()} icon={Users} />
            <KPI loading={isLoading} label="A receber em atraso" value={fmt(consolidated.overdue)} icon={AlertTriangle} tone="danger" />
          </div>

          {leaders && (
            <Card className="p-4">
              <div className="text-sm font-medium flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-amber-500" /> Líderes do grupo (replicar prática)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                <LeaderCell label="Maior receita 90d" row={leaders.revenue} value={leaders.revenue ? fmt(leaders.revenue.wonRevenue90) : "—"} />
                <LeaderCell label="Maior conversão" row={leaders.conversion} value={leaders.conversion ? pct(leaders.conversion.conversion) : "—"} />
                <LeaderCell label="Maior ticket médio" row={leaders.ticket} value={leaders.ticket ? fmt(leaders.ticket.ticketAvg) : "—"} />
                <LeaderCell label="Mais ativa (30d)" row={leaders.activity} value={leaders.activity ? `${leaders.activity.activities30} atividades` : "—"} />
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comparativo" className="space-y-4 mt-4">
          <div className="text-sm text-muted-foreground">
            Sua unidade vs. média do grupo (excluindo a atual).
          </div>
          {currentRow && rows.length > 1 ? (
            <ComparativeGrid current={currentRow} peers={rows.filter((r) => !r.isCurrent)} />
          ) : (
            <Card className="p-6 text-sm text-muted-foreground">
              Adicione mais unidades ao grupo para visualizar comparativo.
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Tabela comparativa (sempre visível abaixo das abas) */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : rows.length === 0 ? null : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Unidade</th>
                  <th className="text-right px-3 py-2">Receita 30d</th>
                  <th className="text-right px-3 py-2">Receita 90d</th>
                  <th className="text-right px-3 py-2">Pipeline</th>
                  <th className="text-right px-3 py-2 hidden md:table-cell">Conversão</th>
                  <th className="text-right px-3 py-2 hidden md:table-cell">Ticket médio</th>
                  <th className="text-right px-3 py-2 hidden lg:table-cell">Clientes ativos</th>
                  <th className="text-right px-3 py-2 hidden lg:table-cell">Novos deals 30d</th>
                  <th className="text-right px-3 py-2 hidden xl:table-cell">Atividades 30d</th>
                  <th className="text-right px-3 py-2 hidden md:table-cell">Em atraso</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.organization_id} className={`border-t hover:bg-accent/30 ${r.isCurrent ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2 font-medium">
                        {r.name}
                        {r.isCurrent && <Badge variant="secondary" className="text-[10px]">atual</Badge>}
                        {!r.isChild && <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">matriz</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.wonRevenue30)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.wonRevenue90)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(r.openPipeline)}</td>
                    <td className="px-3 py-2 text-right hidden md:table-cell">{pct(r.conversion)}</td>
                    <td className="px-3 py-2 text-right hidden md:table-cell font-mono">{fmt(r.ticketAvg)}</td>
                    <td className="px-3 py-2 text-right hidden lg:table-cell">{r.activeCustomers}</td>
                    <td className="px-3 py-2 text-right hidden lg:table-cell">{r.newDeals30}</td>
                    <td className="px-3 py-2 text-right hidden xl:table-cell">{r.activities30}</td>
                    <td className="px-3 py-2 text-right hidden md:table-cell font-mono">
                      {r.overdue > 0 ? <span className="text-destructive">{fmt(r.overdue)}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function LeaderCell({ label, row, value }: { label: string; row: BenchmarkRow | null; value: string }) {
  if (!row) return <div className="text-muted-foreground text-xs">{label}: —</div>;
  return (
    <div className="rounded border bg-card p-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium text-sm truncate">{row.name}</div>
      <div className="text-xs font-mono text-primary">{value}</div>
    </div>
  );
}

function KPI({
  label, value, icon: Icon, tone, loading,
}: {
  label: string; value: string; icon: typeof Trophy;
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
      {loading ? <Skeleton className="h-6 w-24 mt-1" /> : <div className={`text-xl font-semibold mt-1 ${color}`}>{value}</div>}
    </Card>
  );
}

function ComparativeGrid({ current, peers }: { current: BenchmarkRow; peers: BenchmarkRow[] }) {
  const avg = (key: keyof BenchmarkRow) =>
    peers.length ? peers.reduce((s, r) => s + Number(r[key]), 0) / peers.length : 0;

  const metrics: Array<{ key: keyof BenchmarkRow; label: string; format: (n: number) => string; higherIsBetter: boolean }> = [
    { key: "wonRevenue90", label: "Receita 90d", format: fmt, higherIsBetter: true },
    { key: "openPipeline", label: "Pipeline aberto", format: fmt, higherIsBetter: true },
    { key: "conversion", label: "Conversão", format: pct, higherIsBetter: true },
    { key: "ticketAvg", label: "Ticket médio", format: fmt, higherIsBetter: true },
    { key: "activeCustomers", label: "Clientes ativos", format: (n) => n.toString(), higherIsBetter: true },
    { key: "activities30", label: "Atividades 30d", format: (n) => n.toString(), higherIsBetter: true },
    { key: "overdue", label: "Em atraso", format: fmt, higherIsBetter: false },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {metrics.map((m) => {
        const mine = Number(current[m.key]);
        const peerAvg = avg(m.key);
        const diff = mine - peerAvg;
        const diffPct = peerAvg > 0 ? (diff / peerAvg) * 100 : 0;
        const positive = m.higherIsBetter ? diff >= 0 : diff <= 0;
        return (
          <Card key={String(m.key)} className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-semibold">{m.format(mine)}</span>
              <span className="text-xs text-muted-foreground">vs {m.format(peerAvg)}</span>
            </div>
            <div className={`mt-2 text-xs font-medium ${positive ? "text-emerald-600" : "text-destructive"}`}>
              {positive ? "▲" : "▼"} {Math.abs(diffPct).toFixed(1)}% vs média do grupo
            </div>
          </Card>
        );
      })}
    </div>
  );
}
