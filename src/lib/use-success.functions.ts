import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * USE Success Score — índice proprietário 0-100 composto por 9 pilares
 * de crescimento comercial. Cada pilar é calculado a partir de dados já
 * existentes no CRM/ERP conectado; falhas parciais degradam de forma
 * segura para score neutro (50) daquele pilar.
 *
 * Este módulo NÃO é financeiro. Não substitui o ERP. Ele traduz dados
 * operacionais em sinais executivos de crescimento comercial.
 */

const DAY = 86400_000;
const clamp = (n: number, lo = 0, hi = 100) =>
  Math.max(lo, Math.min(hi, Math.round(Number.isFinite(n) ? n : 0)));
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export type SuccessPillar = {
  key:
    | "comercial"
    | "clientes"
    | "marketing"
    | "atendimento"
    | "conversao"
    | "carteira"
    | "crescimento"
    | "cobertura"
    | "oportunidades";
  label: string;
  score: number;      // 0-100
  weight: number;     // pesos somam 1
  value: string;      // legível
  detail: string;     // explicação curta
  trend?: "up" | "down" | "flat";
};

export type SuccessClass = "excelente" | "boa" | "atencao" | "critica";

export type SuccessAction = {
  title: string;
  reason: string;
  href?: string;
  impact_brl?: number;
  channel?: "visita" | "whatsapp" | "email" | "ligacao" | "campanha";
};

export type SuccessDelta = {
  prev_score: number | null;
  prev_computed_at: string | null;
  delta: number;                              // score - prev_score
  direction: "up" | "down" | "flat" | "first";
  explanation: string;                        // frase pronta em pt-BR
  top_positive: { key: string; label: string; delta: number }[];
  top_negative: { key: string; label: string; delta: number }[];
};

export type UseSuccessReport = {
  score: number;
  classification: SuccessClass;
  headline: string;
  pillars: SuccessPillar[];
  actions: SuccessAction[];
  revenue: {
    won30: number;
    won_prev30: number;
    growth: number;
    open_pipeline: number;
    at_risk: number;
  };
  delta: SuccessDelta;
  computed_at: string;
};

function classify(score: number): SuccessClass {
  if (score >= 80) return "excelente";
  if (score >= 65) return "boa";
  if (score >= 45) return "atencao";
  return "critica";
}

export const getUseSuccessReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<UseSuccessReport> => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();
    const t30 = new Date(now - 30 * DAY).toISOString();
    const t60 = new Date(now - 60 * DAY).toISOString();
    const t90 = new Date(now - 90 * DAY).toISOString();

    const safe = async <T,>(p: PromiseLike<T>, fallback: T): Promise<T> => {
      try { return await p; } catch { return fallback; }
    };

    const [dealsRes, invRes, campRes, waRes, churnRes, repurchRes, snapRes, actsRes] = await Promise.all([
      safe(supabase.from("deals")
        .select("id, value, stage, closed_at, created_at")
        .eq("organization_id", org), { data: [] as any[], error: null } as any),
      safe(supabase.from("invoices")
        .select("id, amount, status, due_date, paid_at")
        .eq("organization_id", org), { data: [] as any[], error: null } as any),
      safe(supabase.from("email_campaigns")
        .select("total_sent, total_opened, total_clicked, sent_at")
        .eq("organization_id", org)
        .not("sent_at", "is", null)
        .gte("sent_at", t90), { data: [] as any[], error: null } as any),
      safe(supabase.from("whatsapp_conversations")
        .select("id, last_message_at, status")
        .eq("organization_id", org)
        .gte("last_message_at", t30), { data: [] as any[], error: null } as any),
      safe(supabase.from("ai_churn_predictions")
        .select("churn_probability, risk_level")
        .eq("organization_id", org), { data: [] as any[], error: null } as any),
      safe(supabase.from("ai_repurchase_predictions")
        .select("expected_value, confidence")
        .eq("organization_id", org), { data: [] as any[], error: null } as any),
      safe(supabase.from("customer_360_snapshot")
        .select("recency_days, monetary, last_purchase_at")
        .eq("organization_id", org), { data: [] as any[], error: null } as any),
      safe(supabase.from("activities")
        .select("id, created_at")
        .eq("organization_id", org)
        .gte("created_at", t30), { data: [] as any[], error: null } as any),
    ]);

    const deals = (dealsRes.data ?? []) as any[];
    const invoices = (invRes.data ?? []) as any[];
    const camps = (campRes.data ?? []) as any[];
    const waConvs = (waRes.data ?? []) as any[];
    const churn = (churnRes.data ?? []) as any[];
    const repurch = (repurchRes.data ?? []) as any[];
    const snap = (snapRes.data ?? []) as any[];
    const acts = (actsRes.data ?? []) as any[];

    // ---------- Revenue base ----------
    const won30 = deals
      .filter((d) => d.stage === "won" && d.closed_at && d.closed_at >= t30)
      .reduce((s, d) => s + Number(d.value ?? 0), 0);
    const wonPrev30 = deals
      .filter((d) => d.stage === "won" && d.closed_at && d.closed_at >= t60 && d.closed_at < t30)
      .reduce((s, d) => s + Number(d.value ?? 0), 0);
    const won90 = deals
      .filter((d) => d.stage === "won" && d.closed_at && d.closed_at >= t90)
      .reduce((s, d) => s + Number(d.value ?? 0), 0);
    const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const openPipeline = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);

    // ---------- Conversão ----------
    const closed90 = deals.filter(
      (d) => (d.stage === "won" || d.stage === "lost") && d.closed_at && d.closed_at >= t90,
    );
    const wonCount90 = closed90.filter((d) => d.stage === "won").length;
    const winRate = closed90.length > 0 ? wonCount90 / closed90.length : 0;
    const conversao = clamp(winRate * 200);

    // ---------- Comercial (receita 30d vs alvo = média 90d/3 * 1.1) ----------
    const monthlyAvg = won90 / 3;
    const target = Math.max(monthlyAvg * 1.1, 1);
    const comercial = clamp((won30 / target) * 85);

    // ---------- Crescimento (MoM) ----------
    const growth = wonPrev30 > 0 ? (won30 - wonPrev30) / wonPrev30 : won30 > 0 ? 1 : 0;
    const crescimento = clamp(50 + growth * 100);

    // ---------- Carteira (inverso de inadimplência) ----------
    const totalInv = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const overdue = invoices
      .filter((i) => i.status !== "paid" && i.due_date && new Date(i.due_date).getTime() < now)
      .reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const overdueRatio = totalInv > 0 ? overdue / totalInv : 0;
    const carteira = clamp(100 - overdueRatio * 200);

    // ---------- Clientes (ativos: comprou nos últimos 90d) ----------
    const totalCust = snap.length;
    const activeCust = snap.filter((s) => (s.recency_days ?? 999) <= 90).length;
    const activeRate = totalCust > 0 ? activeCust / totalCust : 0;
    const clientes = clamp(activeRate * 130);

    // ---------- Marketing (open + click rate médio ponderado) ----------
    const sent = camps.reduce((s, c) => s + Number(c.total_sent ?? 0), 0);
    const opened = camps.reduce((s, c) => s + Number(c.total_opened ?? 0), 0);
    const clicked = camps.reduce((s, c) => s + Number(c.total_clicked ?? 0), 0);
    const openRate = sent > 0 ? opened / sent : 0;
    const clickRate = sent > 0 ? clicked / sent : 0;
    const marketing = sent > 0
      ? clamp(openRate * 150 + clickRate * 800)
      : 40;

    // ---------- Atendimento (conversas ativas + atividades 30d) ----------
    const atendimentoBase = waConvs.length + acts.length;
    const atendimento = totalCust > 0
      ? clamp((atendimentoBase / Math.max(totalCust * 0.3, 1)) * 100)
      : clamp(atendimentoBase * 3);

    // ---------- Cobertura (clientes com atividade nos últimos 30d) ----------
    const touched = new Set<string>();
    for (const a of acts) if (a.id) touched.add(String(a.id));
    const coverage = totalCust > 0 ? Math.min(1, touched.size / Math.max(totalCust * 0.25, 1)) : 0;
    const cobertura = clamp(coverage * 100);

    // ---------- Oportunidades (potencial líquido = recompra - risco) ----------
    const potential = repurch.reduce((s, r) => s + Number(r.expected_value ?? 0), 0);
    const critical = churn.filter((c) => Number(c.churn_probability ?? 0) >= 0.7).length;
    const highRisk = churn.filter((c) => Number(c.churn_probability ?? 0) >= 0.4).length;
    const riskRatio = totalCust > 0 ? highRisk / totalCust : 0;
    const oportunidades = clamp(
      50 + (potential > 0 ? Math.min(30, Math.log10(potential + 1) * 6) : -10) - riskRatio * 80,
    );

    const atRisk = churn
      .filter((c) => Number(c.churn_probability ?? 0) >= 0.5)
      .length * (totalInv / Math.max(totalCust, 1)); // aproximação de receita em risco

    const pillars: SuccessPillar[] = [
      {
        key: "comercial", label: "Comercial", score: comercial, weight: 0.15,
        value: fmtBRL(won30),
        detail: `Receita fechada últimos 30d vs alvo (${fmtBRL(target)}).`,
        trend: growth > 0.02 ? "up" : growth < -0.02 ? "down" : "flat",
      },
      {
        key: "conversao", label: "Conversão", score: conversao, weight: 0.15,
        value: pct(winRate),
        detail: `${wonCount90} ganhos em ${closed90.length} fechamentos (90d).`,
      },
      {
        key: "crescimento", label: "Crescimento", score: crescimento, weight: 0.15,
        value: pct(growth),
        detail: `${fmtBRL(won30)} vs ${fmtBRL(wonPrev30)} mês anterior.`,
        trend: growth > 0.02 ? "up" : growth < -0.02 ? "down" : "flat",
      },
      {
        key: "clientes", label: "Clientes", score: clientes, weight: 0.10,
        value: `${activeCust}/${totalCust}`,
        detail: `${pct(activeRate)} da carteira comprou nos últimos 90d.`,
      },
      {
        key: "carteira", label: "Carteira", score: carteira, weight: 0.10,
        value: pct(1 - overdueRatio),
        detail: `${fmtBRL(overdue)} vencido (${pct(overdueRatio, 1)} da carteira).`,
      },
      {
        key: "marketing", label: "Marketing", score: marketing, weight: 0.10,
        value: sent > 0 ? `${pct(openRate)} abertura` : "sem campanhas",
        detail: sent > 0
          ? `${sent.toLocaleString("pt-BR")} envios · ${pct(clickRate, 1)} clique`
          : `Rodar 1 campanha eleva o pilar em pontos rápidos.`,
      },
      {
        key: "atendimento", label: "Atendimento", score: atendimento, weight: 0.10,
        value: `${waConvs.length} conversas`,
        detail: `${acts.length} atividades registradas nos últimos 30d.`,
      },
      {
        key: "cobertura", label: "Cobertura", score: cobertura, weight: 0.05,
        value: pct(coverage),
        detail: `${touched.size} clientes tocados nos últimos 30d.`,
      },
      {
        key: "oportunidades", label: "Oportunidades", score: oportunidades, weight: 0.10,
        value: fmtBRL(potential),
        detail: `Potencial de recompra · ${highRisk} em risco · ${critical} críticos.`,
      },
    ];

    const score = clamp(pillars.reduce((s, p) => s + p.score * p.weight, 0));
    const classification = classify(score);

    // ---------- Ações recomendadas (dos 3 pilares mais fracos) ----------
    const actions: SuccessAction[] = [];
    const weakest = [...pillars].sort((a, b) => a.score - b.score).slice(0, 4);
    for (const p of weakest) {
      if (p.score >= 70) continue;
      switch (p.key) {
        case "comercial":
          actions.push({
            title: `Fechar ${fmtBRL(Math.max(0, target - won30))} para atingir o alvo do mês`,
            reason: `Receita 30d em ${pct(won30 / target)} do alvo.`,
            href: "/pipeline",
            impact_brl: Math.max(0, target - won30),
          });
          break;
        case "conversao":
          actions.push({
            title: "Revisar qualificação e roteiro de proposta",
            reason: `Win-rate ${pct(winRate)} — playbook precisa de ajuste.`,
            href: "/inteligencia-comercial",
          });
          break;
        case "crescimento":
          if (growth < 0)
            actions.push({
              title: "Plano de recuperação de receita",
              reason: `Queda de ${pct(Math.abs(growth))} MoM.`,
              href: "/meu-dia",
            });
          break;
        case "clientes":
          actions.push({
            title: "Reativar clientes inativos há +90d",
            reason: `${totalCust - activeCust} clientes sem compra recente.`,
            href: "/carteira",
            channel: "whatsapp",
          });
          break;
        case "carteira":
          if (overdue > 0)
            actions.push({
              title: `Regularizar ${fmtBRL(overdue)} em cobrança`,
              reason: `${pct(overdueRatio, 1)} da carteira vencida.`,
              href: "/carteira",
              impact_brl: overdue,
            });
          break;
        case "marketing":
          actions.push({
            title: sent > 0 ? "Otimizar linha de assunto e segmentação" : "Rodar primeira campanha segmentada",
            reason: sent > 0
              ? `Abertura ${pct(openRate)} pode subir com A/B test.`
              : "Nenhuma campanha nos últimos 90d.",
            href: "/campaigns",
            channel: "campanha",
          });
          break;
        case "atendimento":
          actions.push({
            title: "Aumentar cadência de follow-up no WhatsApp",
            reason: `Apenas ${waConvs.length} conversas ativas nos últimos 30d.`,
            href: "/whatsapp",
            channel: "whatsapp",
          });
          break;
        case "cobertura":
          actions.push({
            title: "Distribuir visitas para carteira não tocada",
            reason: `${pct(coverage)} de cobertura no mês.`,
            href: "/geo-rota",
            channel: "visita",
          });
          break;
        case "oportunidades":
          if (critical > 0)
            actions.push({
              title: `Recuperar ${critical} clientes críticos`,
              reason: `Risco de churn ≥ 70% detectado pela IA.`,
              href: "/inteligencia-comercial",
              channel: "visita",
            });
          break;
      }
    }

    const headline =
      classification === "excelente"
        ? "Operação saudável — foque em escala e novos mercados."
        : classification === "boa"
          ? "Bom ritmo — ajustes finos abrem espaço para crescer."
          : classification === "atencao"
            ? "Atenção — pilares fracos podem virar risco de receita."
            : "Situação crítica — priorize as ações abaixo esta semana.";

    // ---------- Delta vs. snapshot anterior ----------
    let prev: { score: number; pillars: SuccessPillar[]; computed_at: string } | undefined;
    try {
      const { data: prevRows } = await supabase
        .from("use_success_snapshots")
        .select("score, pillars, computed_at")
        .eq("organization_id", org)
        .order("computed_at", { ascending: false })
        .limit(1);
      prev = (prevRows ?? [])[0] as any;
    } catch { /* first run or table absent */ }

    let delta: SuccessDelta;
    if (!prev) {
      delta = {
        prev_score: null,
        prev_computed_at: null,
        delta: 0,
        direction: "first",
        explanation: "Primeira medição do USE Success Score — os próximos recalculos mostrarão a variação.",
        top_positive: [],
        top_negative: [],
      };
    } else {
      const diffs = pillars.map((p) => {
        const before = prev.pillars.find((x) => x.key === p.key)?.score ?? p.score;
        return { key: p.key, label: p.label, delta: p.score - before };
      });
      const top_positive = diffs.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 2);
      const top_negative = diffs.filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 2);
      const d = score - prev.score;
      const dir: SuccessDelta["direction"] = d > 1 ? "up" : d < -1 ? "down" : "flat";
      const parts: string[] = [];
      if (dir === "up") parts.push(`Score subiu ${d} ponto${Math.abs(d) === 1 ? "" : "s"}`);
      else if (dir === "down") parts.push(`Score caiu ${Math.abs(d)} ponto${Math.abs(d) === 1 ? "" : "s"}`);
      else parts.push("Score estável");
      if (top_positive[0]) parts.push(`impulso em ${top_positive[0].label} (+${top_positive[0].delta})`);
      if (top_negative[0]) parts.push(`pressão em ${top_negative[0].label} (${top_negative[0].delta})`);
      delta = {
        prev_score: prev.score,
        prev_computed_at: prev.computed_at,
        delta: d,
        direction: dir,
        explanation: parts.join(" · ") + ".",
        top_positive,
        top_negative,
      };
    }

    // ---------- Persistir novo snapshot (best-effort) ----------
    await safe(
      supabase.from("use_success_snapshots").insert({
        organization_id: org,
        score,
        classification,
        pillars: pillars as any,
        revenue: {
          won30, won_prev30: wonPrev30, growth,
          open_pipeline: openPipeline, at_risk: atRisk,
        } as any,
      }) as unknown as PromiseLike<unknown>,
      undefined,
    );

    return {
      score,
      classification,
      headline,
      pillars,
      actions: actions.slice(0, 5),
      revenue: {
        won30,
        won_prev30: wonPrev30,
        growth,
        open_pipeline: openPipeline,
        at_risk: atRisk,
      },
      delta,
      computed_at: new Date().toISOString(),
    };
  });

/** Histórico dos últimos snapshots — para sparkline no painel. */
export const listUseSuccessHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      organization_id: z.string().uuid(),
      limit: z.number().int().min(2).max(90).default(30),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("use_success_snapshots")
      .select("score, classification, computed_at")
      .eq("organization_id", data.organization_id)
      .order("computed_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { history: (rows ?? []).slice().reverse() as { score: number; classification: string; computed_at: string }[] };
  });
