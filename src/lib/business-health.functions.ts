import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAY = 86400000;
const orgInput = z.object({ organization_id: z.string().uuid() });

export type HealthPillar = {
  key: string;
  label: string;
  score: number;       // 0-100
  weight: number;      // 0-1
  value: string;       // human-readable
  detail: string;
  trend?: "up" | "down" | "flat";
};

export type HealthReport = {
  score: number;
  previousScore: number | null;
  delta: number | null;
  pillars: HealthPillar[];
  topLevers: { title: string; impact_brl?: number; reason: string; href?: string }[];
  computed_at: string;
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Business Health Score — single 0-100 number for the C-suite.
 *
 * Composed by 5 weighted pillars:
 *  • Pipeline (25%): cobertura do alvo dos próximos 90 dias
 *  • Conversão (20%): win rate ponderado pelos últimos 90 dias
 *  • Velocidade (15%): atividades por negócio aberto + idade média
 *  • Retenção (20%): inverso de inadimplência e churn de receita
 *  • Crescimento (20%): MoM de receita fechada
 */
export const computeBusinessHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }): Promise<HealthReport> => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();
    const monthAgo = new Date(now - 30 * DAY).toISOString();
    const twoMonthsAgo = new Date(now - 60 * DAY).toISOString();
    const ninetyAgo = new Date(now - 90 * DAY).toISOString();

    const [dealsRes, actsRes, invRes, prevRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, value, stage, closed_at, expected_close, created_at, updated_at")
        .eq("organization_id", org),
      supabase
        .from("activities")
        .select("id, deal_id, created_at")
        .eq("organization_id", org)
        .gte("created_at", ninetyAgo),
      supabase
        .from("invoices")
        .select("id, amount, status, due_date, paid_at, created_at")
        .eq("organization_id", org),
      supabase
        .from("business_health_scores")
        .select("score, computed_at")
        .eq("organization_id", org)
        .order("computed_at", { ascending: false })
        .limit(1),
    ]);

    const deals = (dealsRes.data ?? []) as any[];
    const acts = (actsRes.data ?? []) as any[];
    const invoices = (invRes.data ?? []) as any[];

    const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const closedIn90 = deals.filter(
      (d) => (d.stage === "won" || d.stage === "lost") && d.closed_at && d.closed_at >= ninetyAgo,
    );
    const won90 = closedIn90.filter((d) => d.stage === "won");
    const winRate = closedIn90.length > 0 ? won90.length / closedIn90.length : 0;

    // Pipeline coverage: assume target = 3x avg monthly revenue (last 90d)
    const wonRev90 = won90.reduce((s, d) => s + Number(d.value ?? 0), 0);
    const monthlyAvg = wonRev90 / 3;
    const openValue = open.reduce((s, d) => s + Number(d.value ?? 0), 0);
    const target = Math.max(monthlyAvg * 3, 1); // 3x cobertura
    const coverage = openValue / target;
    const pipelineScore = clamp(coverage * 80); // 1.25x => 100

    // Velocidade: atividades/negócio aberto + idade
    const actsPerDeal = open.length > 0 ? acts.length / open.length : 0;
    const avgAgeDays =
      open.length > 0
        ? open.reduce((s, d) => s + (now - new Date(d.created_at).getTime()) / DAY, 0) / open.length
        : 0;
    const velocityScore = clamp(actsPerDeal * 15 - Math.max(0, avgAgeDays - 30) * 0.8);

    // Retenção: inadimplência vs total faturado
    const totalInvoiced = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const overdueAmount = invoices
      .filter((i) => i.status !== "paid" && i.due_date && new Date(i.due_date).getTime() < now)
      .reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const overdueRatio = totalInvoiced > 0 ? overdueAmount / totalInvoiced : 0;
    const retentionScore = clamp(100 - overdueRatio * 200);

    // Crescimento: receita 30d vs 30-60d
    const wonLast30 = deals
      .filter((d) => d.stage === "won" && d.closed_at && d.closed_at >= monthAgo)
      .reduce((s, d) => s + Number(d.value ?? 0), 0);
    const wonPrev30 = deals
      .filter((d) => d.stage === "won" && d.closed_at && d.closed_at >= twoMonthsAgo && d.closed_at < monthAgo)
      .reduce((s, d) => s + Number(d.value ?? 0), 0);
    const growth = wonPrev30 > 0 ? (wonLast30 - wonPrev30) / wonPrev30 : wonLast30 > 0 ? 1 : 0;
    const growthScore = clamp(50 + growth * 100);

    const conversionScore = clamp(winRate * 200); // 50% => 100

    const pillars: HealthPillar[] = [
      {
        key: "pipeline",
        label: "Pipeline",
        score: pipelineScore,
        weight: 0.25,
        value: `${fmtBRL(openValue)} aberto`,
        detail: `Cobertura ${(coverage * 100).toFixed(0)}% do alvo (3× receita mensal média).`,
      },
      {
        key: "conversao",
        label: "Conversão",
        score: conversionScore,
        weight: 0.2,
        value: `${(winRate * 100).toFixed(0)}% win-rate`,
        detail: `${won90.length} ganhos em ${closedIn90.length} fechamentos (90d).`,
      },
      {
        key: "velocidade",
        label: "Velocidade",
        score: velocityScore,
        weight: 0.15,
        value: `${actsPerDeal.toFixed(1)} atv./negócio`,
        detail: `Idade média de ${avgAgeDays.toFixed(0)}d no pipeline.`,
      },
      {
        key: "retencao",
        label: "Retenção",
        score: retentionScore,
        weight: 0.2,
        value: `${(overdueRatio * 100).toFixed(1)}% inadimpl.`,
        detail: `${fmtBRL(overdueAmount)} em faturas vencidas.`,
      },
      {
        key: "crescimento",
        label: "Crescimento",
        score: growthScore,
        weight: 0.2,
        value: `${(growth * 100).toFixed(0)}% MoM`,
        detail: `${fmtBRL(wonLast30)} ganhos nos últimos 30d vs ${fmtBRL(wonPrev30)}.`,
        trend: growth > 0.02 ? "up" : growth < -0.02 ? "down" : "flat",
      },
    ];

    const score = clamp(pillars.reduce((s, p) => s + p.score * p.weight, 0));
    const previous = prevRes.data?.[0];
    const previousScore = previous?.score ?? null;
    const delta = previousScore != null ? score - previousScore : null;

    // Top 5 alavancas: pilares mais fracos -> recomendações específicas
    const sorted = [...pillars].sort((a, b) => a.score - b.score);
    const levers: HealthReport["topLevers"] = [];
    for (const p of sorted.slice(0, 5)) {
      if (p.key === "pipeline" && coverage < 1) {
        levers.push({
          title: `Aumentar pipeline em ${fmtBRL(Math.max(0, target - openValue))}`,
          impact_brl: Math.max(0, target - openValue),
          reason: `Cobertura está em ${(coverage * 100).toFixed(0)}% do alvo. Acione marketing e prospecção.`,
          href: "/marketing",
        });
      } else if (p.key === "conversao" && winRate < 0.3) {
        levers.push({
          title: "Revisar qualificação e proposta",
          reason: `Win-rate de ${(winRate * 100).toFixed(0)}% está abaixo do saudável (30%+).`,
          href: "/ia-comercial",
        });
      } else if (p.key === "velocidade" && (actsPerDeal < 3 || avgAgeDays > 45)) {
        levers.push({
          title: "Ativar follow-ups dos negócios parados",
          reason: `Apenas ${actsPerDeal.toFixed(1)} atividades por negócio e idade média de ${avgAgeDays.toFixed(0)}d.`,
          href: "/pipeline",
        });
      } else if (p.key === "retencao" && overdueRatio > 0.05) {
        levers.push({
          title: `Resolver inadimplência de ${fmtBRL(overdueAmount)}`,
          impact_brl: overdueAmount,
          reason: `${(overdueRatio * 100).toFixed(1)}% do faturado está vencido.`,
          href: "/carteira",
        });
      } else if (p.key === "crescimento" && growth < 0) {
        levers.push({
          title: "Reverter queda de receita MoM",
          reason: `Receita caiu ${Math.abs(growth * 100).toFixed(0)}% vs mês anterior.`,
          href: "/intelligence",
        });
      }
    }

    // Persist for trend
    await supabase.from("business_health_scores").insert({
      organization_id: org,
      score,
      pillars: pillars as any,
    });

    return {
      score,
      previousScore,
      delta,
      pillars,
      topLevers: levers,
      computed_at: new Date().toISOString(),
    };
  });
