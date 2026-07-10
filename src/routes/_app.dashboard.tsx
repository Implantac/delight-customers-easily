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
    <div className="relative p-4 md:p-8 max-w-[1600px] mx-auto space-y-12 pb-24 overflow-x-hidden">
      {/* Background Decor - High Tech Feel */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.07]" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      
      {/* Mural Comercial / Command Center Header */}
      <section className="relative z-10 animate-in-page">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 mb-12 relative">
          {/* Subtle Scanline Effect */}
          <div className="absolute -top-10 -left-10 w-full h-full bg-gradient-to-b from-primary/5 to-transparent opacity-20 pointer-events-none animate-pulse" />
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-3">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: 32 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-[1px] bg-primary rounded-full" 
              />
              <span className="text-[9px] font-black uppercase tracking-[0.5em] text-primary/60">Sistema Operacional Ativo</span>
              <div className="flex items-center gap-2 ml-4 px-2.5 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10 backdrop-blur-md">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Sincronização 100%</span>
              </div>
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight leading-tight text-foreground/90">
              Olá, <span className="text-primary italic">{(user?.user_metadata?.full_name ?? user?.email ?? "").split(" ")[0]}</span>.
            </h1>
            <p className="text-muted-foreground/60 text-base md:text-lg font-medium max-w-xl leading-relaxed">
              Sua inteligência de vendas está processando novos dados. <br className="hidden md:block" />
              Otimizamos <span className="text-foreground font-bold">suas próximas ações</span> para maximizar a conversão hoje.
            </p>
          </div>
          <div className="flex flex-col items-start lg:items-end gap-3 relative z-10">
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 mb-1">Janela de Operação</div>
            <Badge variant="outline" className="h-fit py-3.5 px-8 bg-card/20 text-primary border-primary/10 text-[10px] font-black rounded-2xl shadow-2xl uppercase tracking-[0.2em] backdrop-blur-3xl ring-1 ring-primary/5">
              {new Date().toLocaleDateString("pt-BR", { weekday: 'long', day: '2-digit', month: 'long' })}
            </Badge>
          </div>
        </div>
        
        <MuralComercial />
      </section>

      {/* O QUE PRECISO FAZER HOJE — Sinais acionáveis */}
      <DoTodayPanel />

      {/* KPI Command Bar - Refined with Glassmorphism and Micro-interactions */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 relative z-10">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link to={k.href as any} className="group block h-full">
              <Card className="relative overflow-hidden h-full p-8 border-border/40 bg-card/40 backdrop-blur-2xl hover:border-primary/40 transition-all duration-700 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)] hover:-translate-y-2 rounded-[2rem] group-hover:ring-1 group-hover:ring-primary/20">
                {/* Decorative glow */}
                <div className="absolute -right-20 -top-20 w-40 h-40 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/10 transition-colors duration-700" />
                
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-all duration-700 translate-x-4 group-hover:translate-x-0">
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
                
                <div className="flex items-center justify-between mb-8">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{k.label}</span>
                  <div className={`p-3.5 rounded-2xl bg-secondary/50 ${k.tone} border border-border/20 shadow-sm group-hover:scale-110 group-hover:shadow-lg transition-all duration-700`}>
                    <k.icon className="h-4 w-4" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-3xl font-display font-bold tabular-nums tracking-tight group-hover:text-primary transition-colors duration-700">{k.value}</div>
                  <div className="flex items-center gap-2 mt-4">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/5 border border-primary/10">
                       <span className="text-[10px] text-primary font-bold tracking-tight line-clamp-1">{k.sub}</span>
                    </div>
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
