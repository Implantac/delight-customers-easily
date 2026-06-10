import { createFileRoute, Link } from "@tanstack/react-router";
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
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { BusinessHealthCard } from "@/components/business-health-card";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { Customer360Mini } from "@/components/customer-360-mini";
import { ChurnRiskCard } from "@/components/churn-risk-card";
import { TopOpportunities } from "@/components/dashboard/top-opportunities";
import { ProductTour } from "@/components/product-tour";
import { MuralComercial } from "@/components/dashboard/mural-comercial";
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
    <div className="page-container max-w-[1400px] space-y-10">
      {/* Mural Comercial / Command Center Header */}
      <section>
        <MuralComercial />
      </section>

      {/* O QUE FAZER HOJE - Painel de Ações Imediatas */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-display font-bold tracking-tight uppercase">O QUE FAZER HOJE</h2>
          </div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10">
            {new Date().toLocaleDateString("pt-BR", { weekday: 'long', day: '2-digit', month: 'long' })}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plano do Dia (IA) */}
          <div className="lg:col-span-2">
            <NextActionBlock surface="dashboard" title="Plano de Ação Sugerido pela IA" limit={4} showRegenerate />
          </div>

          {/* Onboarding / Setup */}
          <div data-tour="dashboard-checklist">
            <OnboardingChecklist />
          </div>
        </div>
      </section>

      {/* KPI Command Bar */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Link to={k.href as any} className="group block h-full">
              <Card className="h-full p-5 border-border/40 hover:border-primary/20 transition-all hover:shadow-lg hover:shadow-primary/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k.label}</span>
                  <div className={`p-2 rounded-lg bg-secondary/50 ${k.tone}`}>
                    <k.icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-2xl font-display font-bold">{k.value}</div>
                <div className="text-[11px] text-muted-foreground mt-1 truncate">{k.sub}</div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </section>

      {/* Oportunidades & Saúde */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <TopOpportunities />
        <BusinessHealthCard />
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Customer360Mini />
        <ChurnRiskCard />
      </section>

      {/* Onboarding / Setup */}
      <section data-tour="dashboard-checklist">
        <OnboardingChecklist />
      </section>

      <ProductTour tourId="dashboard-v3" steps={[]} />
    </div>
  );
}

function ActionItem({ icon: Icon, label, sub }: any) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/30 transition-all cursor-pointer bg-card/50">
      <div className="p-2 rounded-lg bg-secondary/80">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <div>
        <div className="text-sm font-bold">{label}</div>
        <div className="text-[10px] text-muted-foreground uppercase">{sub}</div>
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
