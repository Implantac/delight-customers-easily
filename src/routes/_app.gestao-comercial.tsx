import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { RequireManager } from "@/components/require-manager";
import { getSalesAnalytics } from "@/lib/sales-analytics.functions";
import { getWinLossIntel } from "@/lib/winloss.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Gauge, Target, TrendingUp, TrendingDown, ArrowRight, AlertTriangle,
  Zap, Trophy, Filter, LineChart,
} from "lucide-react";

export const Route = createFileRoute("/_app/gestao-comercial")({
  component: () => (
    <RequireManager>
      <ManagerAnalyticsPage />
    </RequireManager>
  ),
});

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const STAGE_LABEL: Record<string, string> = {
  lead: "Lead", qualified: "Qualificado", proposal: "Proposta",
  negotiation: "Negociação", won: "Ganho", lost: "Perdido",
};
const STAGE_TONE: Record<string, string> = {
  lead: "bg-slate-500", qualified: "bg-indigo-500", proposal: "bg-blue-500",
  negotiation: "bg-amber-500", won: "bg-emerald-500", lost: "bg-rose-500",
};

function ManagerAnalyticsPage() {
  const { orgId } = useCurrentOrg();
  const [days, setDays] = useState(90);

  const callAnalytics = useServerFn(getSalesAnalytics);
  const callWinLoss = useServerFn(getWinLossIntel);

  const analytics = useQuery({
    queryKey: ["mgr-analytics", orgId, days],
    enabled: !!orgId,
    queryFn: () => callAnalytics({ data: { organization_id: orgId!, days } }),
  });

  const winloss = useQuery({
    queryKey: ["mgr-winloss", orgId, days],
    enabled: !!orgId,
    queryFn: () => callWinLoss({ data: { organization_id: orgId!, days } }),
  });

  const a = analytics.data;
  const wl = winloss.data;

  const stagesOpen = (a?.funnel ?? []).filter((f) => f.stage !== "won" && f.stage !== "lost");
  const maxCount = Math.max(1, ...stagesOpen.map((f) => f.count));

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Comando Comercial"
        subtitle="Sales velocity, funil, motivos de perda e ranking — para decisões rápidas."
        icon={Gauge}
        action={
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {analytics.isLoading || !a ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Kpi
              icon={<Zap className="h-4 w-4 text-amber-500" />}
              label="Sales velocity"
              value={brl(a.salesVelocity)}
              hint="R$ esperados por dia (opps × ticket × win) / ciclo"
            />
            <Kpi
              icon={<Target className="h-4 w-4 text-emerald-500" />}
              label="Win rate"
              value={pct(a.winRate)}
              hint={`Ciclo médio ${a.avgCycleDays}d · ticket ${brl(a.avgTicket)}`}
            />
            <Kpi
              icon={<TrendingUp className="h-4 w-4 text-blue-500" />}
              label="Pipeline ponderado"
              value={brl(a.weightedPipeline)}
              hint={`${a.openCount} oportunidades · bruto ${brl(a.openValue)}`}
            />
            <Kpi
              icon={<Trophy className="h-4 w-4 text-primary" />}
              label="Cobertura de meta (mês)"
              value={a.monthTarget > 0 ? pct(a.attainment) : "—"}
              hint={
                a.monthTarget > 0
                  ? `Faltam ${brl(a.gap)} em ${a.daysLeft}d → ${brl(a.dailyPace)}/dia`
                  : "Sem meta configurada este mês"
              }
            />
          </>
        )}
      </div>

      {/* FUNIL */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">Funil de conversão</h3>
          </div>
          <Link to="/pipeline" className="text-xs text-primary hover:underline flex items-center gap-1">
            Abrir pipeline <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {analytics.isLoading || !a ? (
          <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : (
          <div className="space-y-2">
            {stagesOpen.map((f) => {
              const w = Math.max(6, (f.count / maxCount) * 100);
              return (
                <div key={f.stage} className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
                  <span className="text-sm text-muted-foreground">{STAGE_LABEL[f.stage]}</span>
                  <div className="h-8 rounded bg-muted overflow-hidden">
                    <div
                      className={`${STAGE_TONE[f.stage]} h-full flex items-center justify-end pr-2 text-xs text-white font-medium`}
                      style={{ width: `${w}%` }}
                    >
                      {f.count}
                    </div>
                  </div>
                  <span className="text-sm tabular-nums text-right w-28">{brl(f.value)}</span>
                </div>
              );
            })}
            <div className="border-t pt-2 mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${STAGE_TONE.won}`} />
                Ganhos: <span className="font-semibold">{a.funnel.find(f=>f.stage==='won')?.count ?? 0}</span>
                <span className="text-muted-foreground">· {brl(a.funnel.find(f=>f.stage==='won')?.value ?? 0)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${STAGE_TONE.lost}`} />
                Perdidos: <span className="font-semibold">{a.funnel.find(f=>f.stage==='lost')?.count ?? 0}</span>
                <span className="text-muted-foreground">· {brl(a.funnel.find(f=>f.stage==='lost')?.value ?? 0)}</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* MOTIVOS DE PERDA + RANKING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-4 w-4 text-rose-500" />
            <h3 className="font-semibold">Top motivos de perda</h3>
          </div>
          {winloss.isLoading || !wl ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : wl.reasons.filter(r => r.outcome === "lost").length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma perda registrada no período.</p>
          ) : (
            <ul className="space-y-2">
              {wl.reasons.filter(r => r.outcome === "lost").slice(0, 6).map((r) => (
                <li key={r.reason} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.reason}</div>
                    <div className="text-xs text-muted-foreground">{r.count} deal(s)</div>
                  </div>
                  <span className="text-sm tabular-nums text-rose-600 dark:text-rose-400">
                    -{brl(r.value)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {wl?.topLossReason && (
            <div className="mt-4 rounded-md border border-rose-200/50 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/50 p-3 text-xs flex gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>
                Maior sangria: <b>{wl.topLossReason.reason}</b> · custou{" "}
                <b>{brl(wl.topLossReason.value)}</b> em oportunidades. Revise objeção e discovery.
              </span>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold">Ranking de vendedores</h3>
          </div>
          {winloss.isLoading || !wl ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : wl.userPerf.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <ul className="space-y-2">
              {wl.userPerf.slice(0, 8).map((u, i) => (
                <li key={u.user_id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="outline" className="h-6 w-6 justify-center p-0 shrink-0">{i + 1}</Badge>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.won}W · {u.lost}L · win {pct(u.winRate)}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm tabular-nums font-semibold">{brl(u.wonValue)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/goals">
                Ver metas e leaderboard completo <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <LineChart className="h-3 w-3" />
        Sales velocity = (oportunidades abertas × ticket médio × win rate) ÷ ciclo médio.
        Pipeline ponderado usa pesos por estágio (lead 10% · qualificado 25% · proposta 50% · negociação 75%).
      </p>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: {
  icon: React.ReactNode; label: string; value: string; hint?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1 leading-tight">{hint}</div>}
    </Card>
  );
}
