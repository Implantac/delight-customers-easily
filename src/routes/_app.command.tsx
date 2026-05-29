import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { useAuth } from "@/lib/auth";
import { computeCommandCenter } from "@/lib/intelligence.functions";
import { getForecast } from "@/lib/forecast.functions";
import { getFinanceOverview } from "@/lib/finance.functions";
import { getRetentionInsights } from "@/lib/churn.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CopilotDrawer } from "@/components/copilot-drawer";
import {
  AlertTriangle, TrendingUp, Target, Clock, Users, ArrowRight,
  Sparkles, Flame, Calendar, DollarSign, HeartPulse, Receipt, Gauge,
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

  const { data, isLoading } = useQuery({
    queryKey: ["command-center", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
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
