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
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-12 pb-24 overflow-x-hidden">
      {/* Mural Comercial / Command Center Header */}
      <section className="animate-in-page">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-[2px] w-12 bg-primary rounded-full" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/80">Operação Comercial</span>
            </div>
            <h1 className="text-4xl md:text-7xl font-display font-bold tracking-tighter leading-none">
              Bem-vindo, <span className="text-primary">{(user?.user_metadata?.full_name ?? user?.email ?? "").split(" ")[0]}</span>.
            </h1>
            <p className="text-muted-foreground text-lg md:text-2xl font-medium max-w-2xl leading-relaxed">
              Sua central de inteligência está pronta. Vamos vender mais hoje?
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <Badge variant="outline" className="h-fit py-2.5 px-6 bg-primary/5 text-primary border-primary/20 text-xs font-bold rounded-2xl shadow-sm uppercase tracking-widest backdrop-blur-md ring-1 ring-primary/10">
              {new Date().toLocaleDateString("pt-BR", { weekday: 'long', day: '2-digit', month: 'long' })}
            </Badge>
          </div>
        </div>
        
        <MuralComercial />
      </section>

      {/* KPI Command Bar - Refined with Glassmorphism and Micro-interactions */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
          >
            <Link to={k.href as any} className="group block h-full">
              <Card className="relative overflow-hidden h-full p-8 border-border/40 bg-gradient-to-br from-card/80 to-card/30 backdrop-blur-xl hover:border-primary/40 transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:-translate-y-1 rounded-[2.5rem] group-hover:ring-1 group-hover:ring-primary/10">
                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
                
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{k.label}</span>
                  <div className={`p-3 rounded-2xl bg-secondary/50 ${k.tone} border border-border/30 shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                    <k.icon className="h-5 w-5" />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-4xl font-display font-bold tabular-nums tracking-tighter group-hover:text-primary transition-colors duration-500">{k.value}</div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-xs text-muted-foreground font-medium tracking-tight line-clamp-1">{k.sub}</span>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </section>

      {/* O QUE FAZER HOJE - Painel de Ações Imediatas */}
      <section className="space-y-8">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-sm">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold tracking-tight">Copiloto de Vendas</h2>
              <p className="text-sm text-muted-foreground font-medium">Recomendações estratégicas geradas por IA</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/5 rounded-xl font-bold text-xs uppercase tracking-widest" asChild>
            <Link to="/nba">Ver tudo <ArrowRight className="ml-2 h-3 w-3" /></Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Plano do Dia (IA) - Expanded */}
          <div className="lg:col-span-2 space-y-6">
            <NextActionBlock 
              surface="dashboard" 
              title="Prioridades de Hoje" 
              limit={4} 
              showRegenerate 
            />
          </div>

          {/* Business Health & Onboarding */}
          <div className="space-y-10">
            <div className="transform transition-all hover:scale-[1.02] duration-500">
              <BusinessHealthCard />
            </div>
            <div data-tour="dashboard-checklist" className="bg-card/30 backdrop-blur-sm rounded-[2rem] border border-border/40 p-1">
              <OnboardingChecklist />
            </div>
          </div>
        </div>
      </section>

      {/* Oportunidades & Saúde */}
      <section className="space-y-8">
        <div className="flex items-center gap-4 px-2">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tight">Pipeline & Saúde de Carteira</h2>
            <p className="text-sm text-muted-foreground font-medium">Monitore o fluxo de receita e riscos de retenção</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="hover:shadow-2xl transition-all duration-700 hover:-translate-y-1 rounded-[2.5rem] overflow-hidden">
            <TopOpportunities />
          </div>
          <div className="hover:shadow-2xl transition-all duration-700 hover:-translate-y-1 rounded-[2.5rem] overflow-hidden">
            <ChurnRiskCard />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="lg:col-span-2 transform transition-all hover:scale-[1.01] duration-500">
          <Customer360Mini />
        </div>
      </section>

      <ProductTour tourId="dashboard-v3" steps={[]} />
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
