import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, Clock, Flame, Sparkles, TrendingUp, Zap, ArrowRight, Activity as ActivityIcon, Trophy,
} from "lucide-react";
import { getCoaching, type NextAction } from "@/lib/coaching.functions";
import { getCoachingLeaderboard } from "@/lib/coaching-leaderboard.functions";

export const Route = createFileRoute("/_app/coaching")({ component: CoachingPage });

const BRL = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const KIND_META: Record<
  NextAction["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  overdue_task: { label: "Tarefa atrasada", icon: AlertTriangle, tone: "text-red-500 bg-red-500/10" },
  deal_closing_soon: { label: "Fechamento próximo", icon: Zap, tone: "text-amber-500 bg-amber-500/10" },
  hot_lead_no_contact: { label: "Lead quente sem contato", icon: Flame, tone: "text-orange-500 bg-orange-500/10" },
  deal_high_value: { label: "Alto valor", icon: TrendingUp, tone: "text-emerald-500 bg-emerald-500/10" },
  deal_stalled: { label: "Negócio parado", icon: Clock, tone: "text-blue-500 bg-blue-500/10" },
  no_activity_week: { label: "Sem atividade", icon: ActivityIcon, tone: "text-muted-foreground bg-muted" },
};

function CoachingPage() {
  const { orgId } = useCurrentOrg();
  const call = useServerFn(getCoaching);
  const { data, isLoading } = useQuery({
    queryKey: ["coaching", orgId],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={Sparkles}
        title="Coaching"
        subtitle="Próximas melhores ações sugeridas pela IA e ranking do time em tempo real."
      />

      <Tabs defaultValue="actions">
        <TabsList>
          <TabsTrigger value="actions">Ações priorizadas</TabsTrigger>
          <TabsTrigger value="leaderboard">Ranking do time</TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="mt-4 space-y-6">
          {isLoading || !data ? (
            <div className="grid gap-4 md:grid-cols-5">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-5">
                <StatCard icon={AlertTriangle} label="Atrasadas" value={data.summary.overdue} tone="text-red-500" />
                <StatCard icon={Zap} label="Fecham em breve" value={data.summary.closingSoon} tone="text-amber-500" />
                <StatCard icon={Flame} label="Leads quentes" value={data.summary.hotLeads} tone="text-orange-500" />
                <StatCard icon={TrendingUp} label="Alto valor" value={data.summary.highValue} tone="text-emerald-500" />
                <StatCard icon={Clock} label="Parados" value={data.summary.stalled} tone="text-blue-500" />
              </div>

              <Card className="overflow-hidden">
                <div className="border-b p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {data.actions.length} ações priorizadas
                  </div>
                </div>
                {data.actions.length === 0 ? (
                  <div className="p-12 text-center text-sm text-muted-foreground">
                    Nenhuma ação pendente. Bom trabalho!
                  </div>
                ) : (
                  <ul className="divide-y">
                    {data.actions.map((a) => {
                      const meta = KIND_META[a.kind];
                      const Icon = meta.icon;
                      return (
                        <li key={a.id} className="flex items-center gap-4 p-4 hover:bg-muted/40">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">{a.title}</p>
                              <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                            </div>
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">{a.reason}</p>
                          </div>
                          <div className="hidden items-center gap-2 md:flex">
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Prioridade</div>
                              <div className="text-sm font-semibold">{a.priority}</div>
                            </div>
                          </div>
                          <Button asChild size="sm" variant="secondary">
                            <Link to={a.link}>
                              {a.cta}
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <LeaderboardTab orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeaderboardTab({ orgId }: { orgId: string | null | undefined }) {
  const call = useServerFn(getCoachingLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["coaching-leaderboard", orgId],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId! } }),
  });

  if (isLoading || !data) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Won (mês)</div>
          <div className="mt-2 text-2xl font-semibold">{BRL(data.teamTotals.wonValue)}</div>
          <div className="text-xs text-muted-foreground">{data.teamTotals.wonCount} negócios</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Pipeline aberto</div>
          <div className="mt-2 text-2xl font-semibold">{BRL(data.teamTotals.pipelineOpen)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Atividades (30d)</div>
          <div className="mt-2 text-2xl font-semibold">{data.teamTotals.activities30}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Reps</div>
          <div className="mt-2 text-2xl font-semibold">{data.rows.length}</div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Rep</th>
              <th className="px-4 py-2">Score</th>
              <th className="px-4 py-2 text-right">Won</th>
              <th className="px-4 py-2 text-right">Meta</th>
              <th className="px-4 py-2 text-right">Pipeline</th>
              <th className="px-4 py-2 text-right">Ativid. 30d</th>
              <th className="px-4 py-2 text-right">Parados</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Sem dados ainda.</td></tr>
            ) : data.rows.map((r: any, i: number) => (
              <tr key={r.user_id} className="border-t">
                <td className="px-4 py-3 text-muted-foreground">
                  {i === 0 ? <Trophy className="h-4 w-4 text-amber-500" /> : i + 1}
                </td>
                <td className="px-4 py-3 font-medium">
                  {r.name}
                  <span className="ml-2 text-xs text-muted-foreground">{r.role}</span>
                </td>
                <td className="px-4 py-3 w-44">
                  <div className="flex items-center gap-2">
                    <Progress value={r.score} className="h-2" />
                    <span className="w-8 text-right text-xs font-semibold">{r.score}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">{BRL(r.wonValue)}<div className="text-xs text-muted-foreground">{r.wonCount}×</div></td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {r.goal > 0 ? BRL(r.goal) : "—"}
                  {r.attainment != null && (
                    <div className="text-xs">{(r.attainment * 100).toFixed(0)}%</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{BRL(r.pipelineOpen)}<div className="text-xs text-muted-foreground">{r.pipelineCount}</div></td>
                <td className="px-4 py-3 text-right">{r.activities30}</td>
                <td className="px-4 py-3 text-right">
                  {r.stalledCount > 0 ? (
                    <Badge variant="outline" className="text-amber-600">{r.stalledCount}</Badge>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, tone,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </Card>
  );
}
