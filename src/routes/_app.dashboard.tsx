import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, TrendingUp, Target, Users, ArrowRight,
  Flame, HeartPulse, Award, Gauge,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { BusinessHealthCard } from "@/components/business-health-card";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { useCurrentOrg } from "@/lib/org";
import { getForecast } from "@/lib/forecast.functions";
import { getRetentionInsights } from "@/lib/churn.functions";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const STAGE_LABEL: Record<string, string> = {
  lead: "Lead", qualified: "Qualif.", proposal: "Proposta",
  negotiation: "Negoc.", won: "Ganho", lost: "Perdido",
};

/**
 * Revenue Command Center — Onda 2.
 * Substitui o dashboard "relatório" por um painel acionável:
 * "o que preciso fazer hoje para vender mais?".
 *
 * Componentes-chave:
 *  • Business Health Score (saúde geral 0–100)
 *  • KPI strip: receita ganha (mês), pipeline ponderado, gap-to-goal,
 *    receita em risco, clientes sem compra.
 *  • Plano do dia (NextActionBlock — recomendações IA).
 *  • Oportunidades prioritárias (top deals abertos por valor).
 *  • Cobertura de representantes (atingimento da meta no mês).
 *  • Clientes em risco (churn alto).
 */
function DashboardPage() {
  const { orgId } = useCurrentOrg();

  const forecast = useServerFn(getForecast);
  const retention = useServerFn(getRetentionInsights);

  const dashQuery = useQuery({
    queryKey: ["dashboard-rcc", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
      const [contacts, companies, deals, openDeals] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("id, value, stage, updated_at").gte("updated_at", since),
        supabase
          .from("deals")
          .select("id, title, value, stage, expected_close, company_id, companies(name)")
          .not("stage", "in", "(won,lost)")
          .order("value", { ascending: false })
          .limit(6),
      ]);
      return {
        contacts: contacts.count ?? 0,
        companies: companies.count ?? 0,
        deals: deals.data ?? [],
        topOpen: (openDeals.data ?? []) as any[],
      };
    },
  });

  const forecastQuery = useQuery({
    queryKey: ["dashboard-forecast", orgId],
    enabled: !!orgId,
    queryFn: () => forecast({ data: { organization_id: orgId! } }),
    staleTime: 5 * 60_000,
  });

  const retentionQuery = useQuery({
    queryKey: ["dashboard-retention", orgId],
    enabled: !!orgId,
    queryFn: () => retention({ data: { organization_id: orgId! } }),
    staleTime: 5 * 60_000,
  });

  const fc = forecastQuery.data;
  const ret = retentionQuery.data;

  const atRiskValue = (ret?.rows ?? [])
    .filter((r) => r.level === "risco")
    .reduce((s, r) => s + Number(r.won_value || 0), 0);
  const atRiskCount = ret?.summary?.em_risco ?? 0;
  const noPurchaseCount = (ret?.rows ?? []).filter(
    (r) => r.deals_won === 0 && (r.days_silent ?? 0) >= 30,
  ).length;

  const kpis = [
    {
      label: "Receita ganha (mês)",
      value: fc ? fmtBRL(fc.current.won) : "—",
      sub: fc ? `Meta ${fmtBRL(fc.current.target)}` : "Carregando…",
      icon: TrendingUp,
      tone: "text-emerald-600",
      href: "/forecast",
    },
    {
      label: "Pipeline ponderado",
      value: fc ? fmtBRL(fc.current.weighted) : "—",
      sub: fc ? `${fc.current.attainment}% do alvo projetado` : "—",
      icon: Target,
      tone: "text-primary",
      href: "/pipeline",
    },
    {
      label: "Gap para meta",
      value: fc ? fmtBRL(fc.current.gap) : "—",
      sub: fc && fc.current.gap > 0 ? "Falta fechar até o fim do mês" : "Meta atingida ✓",
      icon: Flame,
      tone: fc && fc.current.gap > 0 ? "text-warning" : "text-emerald-600",
      href: "/forecast",
    },
    {
      label: "Receita em risco",
      value: fmtBRL(atRiskValue),
      sub: `${atRiskCount} clientes em risco · ${noPurchaseCount} sem compra`,
      icon: AlertTriangle,
      tone: atRiskCount > 0 ? "text-destructive" : "text-muted-foreground",
      href: "/retention",
    },
  ];

  const reps = (fc?.reps ?? []).filter((r) => r.target > 0).slice(0, 5);
  const riskRows = (ret?.rows ?? []).filter((r) => r.level === "risco").slice(0, 5);

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        icon={Gauge}
        title="Revenue Command Center"
        subtitle="O que precisa acontecer hoje para vender mais"
        action={
          <Button asChild size="sm" variant="outline">
            <Link to="/meu-dia">
              <Flame className="mr-1 h-4 w-4" /> Meu dia
            </Link>
          </Button>
        }
      />


      <div className="mt-6">
        <OnboardingChecklist />
      </div>

      {/* Saúde geral + plano do dia lado a lado em telas largas */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <BusinessHealthCard />
        <NextActionBlock surface="dashboard" title="Plano do dia" showRegenerate />
      </div>

      {/* KPI strip — sempre acionável (cada um leva para o módulo correto) */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <Link key={k.label} to={k.href as any} className="group block">
            <Card
              className="kpi-card relative h-full overflow-hidden p-5 animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {k.label}
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-card ${k.tone}`}>
                  <k.icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p
                data-slot="kpi-value"
                className="relative mt-3 font-display text-[1.75rem] font-semibold leading-none tracking-[-0.03em]"
              >
                {k.value}
              </p>
              <p className="relative mt-2 text-xs text-muted-foreground">{k.sub}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* Oportunidades prioritárias + Representantes */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Oportunidades prioritárias</h3>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/pipeline">
                Pipeline <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {dashQuery.isLoading && (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            )}
            {!dashQuery.isLoading && (dashQuery.data?.topOpen ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem oportunidades abertas. Bora prospectar — comece em{" "}
                <Link to="/marketing" className="underline">Leads</Link>.
              </p>
            )}
            {(dashQuery.data?.topOpen ?? []).map((d) => {
              const company = d.companies?.name ?? "Sem empresa";
              const close = d.expected_close
                ? new Date(d.expected_close).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                : "—";
              return (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {company} · fechamento {close}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmtBRL(Number(d.value || 0))}</p>
                    <Badge variant="outline" className="mt-0.5 text-[10px]">
                      {STAGE_LABEL[d.stage] ?? d.stage}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Cobertura de representantes</h3>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/goals">
                Detalhes <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {forecastQuery.isLoading && (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            )}
            {!forecastQuery.isLoading && reps.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma meta atribuída no mês.{" "}
                <Link to="/goals" className="underline">Definir metas</Link>.
              </p>
            )}
            {reps.map((r) => {
              const pct = Math.min(100, r.attainment);
              const tone =
                pct >= 90 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-destructive";
              return (
                <div key={r.user_id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="text-muted-foreground">
                      {fmtBRL(r.won)} <span className="text-xs">/ {fmtBRL(r.target)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-muted">
                    <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {pct}% projetado · gap {fmtBRL(r.gap)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Clientes em risco — call-to-action de retenção */}
      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-destructive" />
            <h3 className="font-semibold">Clientes em risco</h3>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link to="/retention">
              Retenção & churn <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {retentionQuery.isLoading && (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          )}
          {!retentionQuery.isLoading && riskRows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum cliente sinalizado como risco agora. 🎉
            </p>
          )}
          {riskRows.map((r) => (
            <Link
              key={r.company_id}
              to={`/companies/${r.company_id}` as any}
              className="rounded-md border p-3 transition-colors hover:bg-accent/40"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <Badge variant="destructive" className="text-[10px]">
                  risco {r.risk}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.days_silent != null ? `${r.days_silent}d sem contato · ` : ""}
                {fmtBRL(Number(r.won_value || 0))} histórico
              </p>
              {r.reasons[0] && (
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{r.reasons[0]}</p>
              )}
            </Link>
          ))}
        </div>
      </Card>

      {/* Cobertura de base — contadores leves */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <CountTile label="Contatos" value={dashQuery.data?.contacts ?? 0} icon={Users} href="/contacts" />
        <CountTile label="Empresas" value={dashQuery.data?.companies ?? 0} icon={Users} href="/companies" />
        <CountTile
          label="Clientes ativos"
          value={(ret?.rows ?? []).filter((r) => r.deals_won > 0).length}
          icon={HeartPulse}
          href="/carteira"
        />
        <CountTile
          label="Sem compra 30d+"
          value={noPurchaseCount}
          icon={AlertTriangle}
          href="/carteira"
        />
      </div>
    </div>
  );
}

function CountTile({
  label, value, icon: Icon, href,
}: { label: string; value: number; icon: typeof Users; href: string }) {
  return (
    <Link to={href as any} className="group block">
      <Card className="flex items-center gap-3 p-4 transition-colors group-hover:bg-accent/40">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/60 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </Card>
    </Link>
  );
}
