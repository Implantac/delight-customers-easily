import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { computeCommandCenter } from "@/lib/intelligence.functions";
import { getForecast } from "@/lib/forecast.functions";

import { getRetentionInsights } from "@/lib/churn.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CopilotDrawer } from "@/components/copilot-drawer";
import { BusinessHealthCard } from "@/components/business-health-card";
import { NextActionBlock } from "@/components/next-action-block";
import {
  AlertTriangle, TrendingUp, Target, Clock, Users, ArrowRight,
  Sparkles, Flame, Calendar, DollarSign, HeartPulse, Gauge, Zap,
} from "lucide-react";

export const Route = createFileRoute("/_app/command")({ component: CommandCenter });

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function CommandCenter() {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const run = useServerFn(computeCommandCenter);
  const runForecast = useServerFn(getForecast);
  
  const runRetention = useServerFn(getRetentionInsights);

  const { data, isLoading } = useQuery({
    queryKey: ["command-center", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });
  const { data: forecast } = useQuery({
    queryKey: ["cc-forecast", orgId],
    enabled: !!orgId,
    queryFn: () => runForecast({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });
  const { data: retention } = useQuery({
    queryKey: ["cc-retention", orgId],
    enabled: !!orgId,
    queryFn: () => runRetention({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });

  const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data: hotDeals } = useQuery({
    queryKey: ["cc-hot-deals", orgId, in30],
    enabled: !!orgId,
    queryFn: async () =>
      (await supabase
        .from("deals")
        .select("id, title, value, stage, expected_close, companies(name)")
        .eq("organization_id", orgId!)
        .not("stage", "in", "(won,lost)")
        .lte("expected_close", in30)
        .order("value", { ascending: false })
        .limit(6)).data ?? [],
    refetchOnWindowFocus: false,
  });

  const firstName = (user?.user_metadata?.full_name ?? user?.email ?? "").toString().split(" ")[0] ?? "";


  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        subtitle="Onde está o dinheiro que ainda não estamos ganhando — e o que fazer hoje."
        action={<CopilotDrawer />}
      />

      <BusinessHealthCard />

      <NextActionBlock surface="dashboard" title="Ações para hoje" showRegenerate />



      {isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-48" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-64" /><Skeleton className="h-64" />
          </div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={DollarSign} label="Pipeline aberto" value={fmt(data.kpi.pipeline_value)} hint={`${data.kpi.open_count} negócios`} accent="primary" />
            <Kpi icon={TrendingUp} label="Forecast 90 dias" value={fmt(data.kpi.forecast_90d)} hint="Ponderado por estágio" accent="emerald" />
            <Kpi icon={AlertTriangle} label="Valor em risco" value={fmt(data.kpi.value_at_risk)} hint={`${data.at_risk_deals.length} negócios parados`} accent="amber" />
            <Kpi icon={Target} label="Suas tarefas atrasadas" value={String(data.kpi.my_overdue)} hint={`${data.kpi.my_open_deals} negócios seus em aberto`} accent="rose" />
          </div>

          {/* Cockpit Executivo: Meta · Inadimplência · Churn */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Meta do mês</h3>
                <Badge variant="outline" className="ml-auto">{forecast?.current.attainment ?? 0}%</Badge>
              </div>
              {forecast ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold tracking-tight">{fmt(forecast.current.projected)}</span>
                    <span className="text-xs text-muted-foreground">de {fmt(forecast.current.target)}</span>
                  </div>
                  <Progress value={Math.min(100, forecast.current.attainment)} className="mt-3 h-2" />
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-border/50 p-2">
                      <p className="text-muted-foreground">Ganho</p>
                      <p className="font-semibold">{fmt(forecast.current.won)}</p>
                    </div>
                    <div className="rounded-md border border-border/50 p-2">
                      <p className="text-muted-foreground">Gap p/ meta</p>
                      <p className="font-semibold text-amber-600">{fmt(forecast.current.gap)}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                    <Link to="/forecast">Abrir previsão <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </>
              ) : <Skeleton className="h-32" />}
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-4 w-4 text-rose-500" />
                <h3 className="font-semibold">Inadimplência</h3>
                {finance && finance.totals.count_overdue > 0 && (
                  <Badge variant="destructive" className="ml-auto">{finance.totals.count_overdue}</Badge>
                )}
              </div>
              {finance ? (
                <>
                  <p className="text-2xl font-bold tracking-tight text-rose-600">{fmt(finance.totals.overdue)}</p>
                  <p className="text-xs text-muted-foreground">vencidos · {fmt(finance.totals.open)} em aberto</p>
                  {finance.topDebtors.length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {finance.topDebtors.slice(0, 3).map((d) => (
                        <li key={d.company_id} className="flex items-center justify-between text-xs rounded-md border border-border/50 p-2">
                          <span className="truncate">{d.name}</span>
                          <span className="font-semibold shrink-0 ml-2">{fmt(d.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">Nenhum devedor identificado.</p>
                  )}
                  <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                    <Link to="/finance">Abrir financeiro <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </>
              ) : <Skeleton className="h-32" />}
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <HeartPulse className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold">Clientes em risco</h3>
                {retention && retention.summary.em_risco > 0 && (
                  <Badge variant="destructive" className="ml-auto">{retention.summary.em_risco}</Badge>
                )}
              </div>
              {retention ? (
                <>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md border border-border/50 p-2 text-center">
                      <p className="text-rose-600 font-bold text-lg">{retention.summary.em_risco}</p>
                      <p className="text-muted-foreground">Risco</p>
                    </div>
                    <div className="rounded-md border border-border/50 p-2 text-center">
                      <p className="text-amber-600 font-bold text-lg">{retention.summary.atencao}</p>
                      <p className="text-muted-foreground">Atenção</p>
                    </div>
                    <div className="rounded-md border border-border/50 p-2 text-center">
                      <p className="text-emerald-600 font-bold text-lg">{retention.summary.saudaveis}</p>
                      <p className="text-muted-foreground">Saudáveis</p>
                    </div>
                  </div>
                  {retention.rows.filter((r) => r.level === "risco").slice(0, 3).length > 0 ? (
                    <ul className="mt-3 space-y-1.5">
                      {retention.rows.filter((r) => r.level === "risco").slice(0, 3).map((r) => (
                        <li key={r.company_id} className="flex items-center justify-between text-xs rounded-md border border-border/50 p-2">
                          <span className="truncate">{r.name}</span>
                          <Badge variant="outline" className="text-rose-600 shrink-0 ml-2">{r.risk}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">Base saudável no momento.</p>
                  )}
                  <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                    <Link to="/retention">Abrir retenção <ArrowRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </>
              ) : <Skeleton className="h-32" />}
            </Card>
          </div>

          {/* Oportunidades quentes (próximas a fechar) */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-amber-500" />
              <h3 className="font-semibold">Oportunidades quentes</h3>
              <span className="ml-auto text-xs text-muted-foreground">Fechamento previsto nos próximos 30 dias</span>
            </div>
            {!hotDeals || hotDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma oportunidade com fechamento previsto nas próximas semanas. Hora de prospectar.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {hotDeals.map((d: any) => {
                  const days = Math.ceil((new Date(d.expected_close).getTime() - Date.now()) / (24 * 3600 * 1000));
                  return (
                    <li key={d.id} className="flex items-center gap-3 rounded-md border border-border/50 p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{d.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.companies?.name ?? "—"} · {d.stage}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold tabular-nums">{fmt(Number(d.value))}</p>
                        <p className={`text-xs ${days < 0 ? "text-rose-600" : days <= 7 ? "text-amber-600" : "text-muted-foreground"}`}>
                          {days < 0 ? `${-days}d atrasado` : days === 0 ? "hoje" : `em ${days}d`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link to="/pipeline">Abrir pipeline <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </Card>





          {/* Plano do dia */}
          <Card className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[var(--gradient-subtle)]" />
            <div className="relative flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold tracking-tight">Plano do dia</h2>
              <Badge variant="secondary" className="ml-auto">{data.actions.length} ações</Badge>
            </div>
            {data.actions.length === 0 ? (
              <p className="relative mt-4 text-sm text-muted-foreground">Nada urgente agora. Bom momento para prospectar.</p>
            ) : (
              <ul className="relative mt-4 space-y-2">
                {data.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/60 p-3 transition-colors hover:bg-accent/40">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/60">
                      {a.kind === "deal_followup" ? <Flame className="h-4 w-4 text-amber-500" /> :
                       a.kind === "reengage" ? <Users className="h-4 w-4 text-blue-500" /> :
                       a.kind === "task" ? <Clock className="h-4 w-4 text-rose-500" /> :
                       <Sparkles className="h-4 w-4 text-emerald-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
                    </div>
                    {a.link && (
                      <Button asChild size="sm" variant="ghost" className="shrink-0">
                        <Link to={a.link as any}>Abrir <ArrowRight className="ml-1 h-3 w-3" /></Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Risk + Silent */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="font-semibold">Receita em risco</h3>
                <span className="ml-auto text-xs text-muted-foreground">Negócios sem movimento</span>
              </div>
              {data.at_risk_deals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum negócio parado há mais de 14 dias. Pipeline saudável.</p>
              ) : (
                <ul className="space-y-2">
                  {data.at_risk_deals.slice(0, 6).map((d: any) => (
                    <li key={d.id} className="flex items-center gap-3 rounded-md border border-border/50 p-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{d.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {(d.contacts?.name ?? d.companies?.name ?? "—")} · {d.stage}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{fmt(Number(d.value))}</p>
                        <p className="text-xs text-amber-600">{d.stale_days}d parado</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link to="/pipeline">Ver pipeline completo</Link>
              </Button>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold">Clientes silenciosos</h3>
                <span className="ml-auto text-xs text-muted-foreground">Sem contato há 60+ dias</span>
              </div>
              {data.silent_contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sua base está bem engajada.</p>
              ) : (
                <ul className="space-y-2">
                  {data.silent_contacts.slice(0, 6).map((c: any) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-md border border-border/50 p-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <Link to="/contacts/$id" params={{ id: c.id }} className="font-medium truncate hover:underline block">{c.name}</Link>
                      </div>
                      <Badge variant="outline" className="text-xs">{c.days_silent}d</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Tarefas e recompra */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-rose-500" />
                <h3 className="font-semibold">Tarefas atrasadas</h3>
              </div>
              {data.overdue_tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem pendências em atraso.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.overdue_tasks.slice(0, 6).map((a: any) => (
                    <li key={a.id} className="flex items-center justify-between rounded-md border border-border/50 p-2 text-sm">
                      <span className="truncate">{a.title}</span>
                      <Badge variant="destructive" className="text-xs shrink-0">{a.type}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                <Link to="/activities">Ir para atividades</Link>
              </Button>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <h3 className="font-semibold">Oportunidades de recompra</h3>
              </div>
              {data.reengagement.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem oportunidades de recompra identificadas no momento.</p>
              ) : (
                <ul className="space-y-2">
                  {data.reengagement.map((c: any) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-md border border-border/50 p-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <Link to="/contacts/$id" params={{ id: c.id }} className="font-medium truncate hover:underline block">{c.name}</Link>
                        <p className="text-xs text-muted-foreground">Já fechou negócio · silencioso há {c.days_silent}d</p>
                      </div>
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/contacts/$id" params={{ id: c.id }}>Abrir</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: string; hint?: string; accent: "primary" | "emerald" | "amber" | "rose" }) {
  const ring = {
    primary: "text-primary",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
  }[accent];
  return (
    <Card className="relative overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[var(--gradient-subtle)]" />
      <div className="relative flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-md bg-accent/60 ${ring}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="relative mt-2 text-xl font-bold tracking-tight">{value}</p>
      {hint && <p className="relative text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
