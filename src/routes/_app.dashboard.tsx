import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  AlertTriangle, TrendingUp, Target, Users, ArrowRight,
  Flame, HeartPulse, Award, Gauge, Sparkles, BrainCircuit,
  Zap, MessageSquare, MapPin, Calendar, CheckSquare
} from "lucide-react";

import { NextActionBlock } from "@/components/next-action-block";
import { BusinessHealthCard } from "@/components/business-health-card";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { Customer360Mini } from "@/components/customer-360-mini";
import { ChurnRiskCard } from "@/components/churn-risk-card";
import { TopOpportunities } from "@/components/dashboard/top-opportunities";
import { ProductTour } from "@/components/product-tour";
import { MuralComercial } from "@/components/dashboard/mural-comercial";
import { DoTodayPanel } from "@/components/dashboard/do-today-panel";
import { DailyBriefing } from "@/components/dashboard/daily-briefing";
import { GrowthPulse } from "@/components/dashboard/growth-pulse";
import { useCurrentOrg } from "@/lib/org";
import { getForecast } from "@/lib/forecast.functions";
import { getRetentionInsights } from "@/lib/churn.functions";
import { useAuth } from "@/lib/auth";

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
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const navigate = useNavigate();

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
      tone: "text-emerald-500",
      href: "/forecast",
    },
    {
      label: "Pipeline ponderado",
      value: fc ? fmtBRL(fc.current.weighted) : "—",
      sub: fc ? `${fc.current.attainment}% do alvo projetado` : "—",
      icon: Target,
      tone: "text-blue-500",
      href: "/pipeline",
    },
    {
      label: "Gap para meta",
      value: fc ? fmtBRL(fc.current.gap) : "—",
      sub: fc && fc.current.gap > 0 ? "Falta fechar este mês" : "Meta atingida ✓",
      icon: Flame,
      tone: fc && fc.current.gap > 0 ? "text-orange-500" : "text-emerald-500",
      href: "/forecast",
    },
    {
      label: "Receita em risco",
      value: fmtBRL(atRiskValue),
      sub: `${atRiskCount} clientes críticos`,
      icon: AlertTriangle,
      tone: atRiskCount > 0 ? "text-rose-500" : "text-muted-foreground",
      href: "/retention",
    },
  ];

  const reps = (fc?.reps ?? []).filter((r) => r.target > 0).slice(0, 5);
  const riskRows = (ret?.rows ?? []).filter((r) => r.level === "risco").slice(0, 5);

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto space-y-4 md:space-y-5 pb-16">
      {/* Header compacto */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-2 border-b border-border/40">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground truncate">
              Sincronizado · Tempo real
            </span>
          </div>
          <h1 className="truncate font-display text-lg sm:text-xl md:text-2xl font-semibold tracking-tight text-foreground">
            Olá, <span className="text-primary">{(user?.user_metadata?.full_name ?? user?.email ?? "").split(" ")[0]}</span>
          </h1>
          <p className="mt-0.5 truncate text-[11px] sm:text-xs text-muted-foreground">
            Suas prioridades comerciais de hoje, geradas por IA.
          </p>
        </div>
        <Badge variant="outline" className="h-fit py-1 px-2 sm:px-2.5 text-[10px] sm:text-[11px] font-medium capitalize shrink-0">
          {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
        </Badge>
      </header>

      {/* Growth Pulse — USE Success + próxima jogada */}
      <GrowthPulse />

      {/* KPI strip compacto */}
      <section className="grid grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25, ease: "easeOut" }}
          >
            <Link to={k.href as any} className="group block h-full">
              <Card className="relative h-full p-3 sm:p-3.5 border-border/60 bg-card hover:border-primary/50 hover:bg-accent/30 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground truncate">
                    {k.label}
                  </span>
                  <k.icon className={`h-3.5 w-3.5 shrink-0 ${k.tone}`} />
                </div>
                <div className="text-base sm:text-lg md:text-xl font-display font-semibold tabular-nums tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                  {k.value}
                </div>
                <div className="mt-0.5 text-[10.5px] sm:text-[11px] text-muted-foreground truncate">{k.sub}</div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </section>

      {/* Foco do dia + Saúde */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-7 lg:col-span-8 space-y-4 min-w-0">
          <DoTodayPanel />
          <NextActionBlock surface="dashboard" title="Copiloto — Prioridades" limit={4} showRegenerate />
        </div>
        <div className="md:col-span-5 lg:col-span-4 space-y-4 min-w-0">
          <BusinessHealthCard />
          <div data-tour="dashboard-checklist">
            <OnboardingChecklist />
          </div>
        </div>
      </section>

      {/* Briefing + Mural lado a lado */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DailyBriefing />
        <MuralComercial />
      </section>

      {/* Pipeline + retenção */}
      <section className="space-y-3">
        <SectionTitle
          icon={TrendingUp}
          title="Pipeline & Retenção"
          subtitle="Fluxo de receita e riscos"
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-7 lg:col-span-8 min-w-0"><TopOpportunities /></div>
          <div className="md:col-span-5 lg:col-span-4 min-w-0"><ChurnRiskCard /></div>
        </div>
      </section>


      <section>
        <Customer360Mini />
      </section>

      <ProductTour tourId="dashboard-v3" steps={[]} />
    </div>
  );
}

function SectionTitle({
  icon: Icon, title, subtitle, action,
}: { icon: typeof Sparkles; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-7 w-7 shrink-0 grid place-items-center rounded-md border border-border/60 bg-card">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold tracking-tight text-foreground truncate">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
      {action}
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
