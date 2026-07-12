import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Executive Signals — consolida sinais do CRM em cards "Sinal → Ação"
 * para o Dashboard Executivo. Cada card carrega um CTA direto para a
 * tela onde a ação acontece (pipeline, carteira, geo, campanhas, etc).
 */

const DAY = 86400_000;
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export type SignalTone = "critical" | "warn" | "opportunity" | "info";

export type ExecutiveSignal = {
  key: string;
  tone: SignalTone;
  category: "churn" | "recompra" | "carteira" | "meta" | "cobertura" | "pipeline";
  title: string;
  metric?: string;
  reason: string;
  cta: { label: string; href: string };
  impact_brl?: number;
};

export const getExecutiveSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<{ signals: ExecutiveSignal[]; computed_at: string }> => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();
    const t30 = new Date(now - 30 * DAY).toISOString();
    const t90 = new Date(now - 90 * DAY).toISOString();

    const safe = async <T,>(p: PromiseLike<T>, fallback: T): Promise<T> => {
      try { return await p; } catch { return fallback; }
    };

    const [churnRes, repurchRes, dealsRes, invRes, snapRes, goalsRes] = await Promise.all([
      safe(supabase.from("ai_churn_predictions")
        .select("customer_id, churn_probability, risk_level")
        .eq("organization_id", org), { data: [] as any[] } as any),
      safe(supabase.from("ai_repurchase_predictions")
        .select("customer_id, expected_value, confidence")
        .eq("organization_id", org)
        .order("expected_value", { ascending: false })
        .limit(50), { data: [] as any[] } as any),
      safe(supabase.from("deals")
        .select("id, value, stage, closed_at")
        .eq("organization_id", org)
        .gte("closed_at", t90), { data: [] as any[] } as any),
      safe(supabase.from("invoices")
        .select("amount, status, due_date")
        .eq("organization_id", org), { data: [] as any[] } as any),
      safe(supabase.from("customer_360_snapshot")
        .select("recency_days, monetary")
        .eq("organization_id", org), { data: [] as any[] } as any),
      safe(supabase.from("sales_goals")
        .select("target_value, period_start, period_end")
        .eq("organization_id", org)
        .lte("period_start", new Date(now).toISOString())
        .gte("period_end", new Date(now).toISOString())
        .limit(1), { data: [] as any[] } as any),
    ]);

    const churn = (churnRes.data ?? []) as any[];
    const repurch = (repurchRes.data ?? []) as any[];
    const deals = (dealsRes.data ?? []) as any[];
    const invoices = (invRes.data ?? []) as any[];
    const snap = (snapRes.data ?? []) as any[];
    const goals = (goalsRes.data ?? []) as any[];

    const signals: ExecutiveSignal[] = [];

    // ---------- Churn crítico ----------
    const critical = churn.filter((c) => Number(c.churn_probability ?? 0) >= 0.7);
    if (critical.length > 0) {
      const avgTicket = snap.reduce((s, x) => s + Number(x.monetary ?? 0), 0) / Math.max(snap.length, 1);
      const est = Math.round(critical.length * avgTicket * 0.3);
      signals.push({
        key: "churn-critical",
        tone: "critical",
        category: "churn",
        title: `${critical.length} clientes em risco crítico de churn`,
        metric: `≥ 70% probabilidade`,
        reason: est > 0 ? `Receita em risco estimada: ${brl(est)} nos próximos 90d.` : "Ação imediata protege recorrência.",
        cta: { label: "Ver clientes em risco", href: "/inteligencia-comercial" },
        impact_brl: est > 0 ? est : undefined,
      });
    }

    // ---------- Oportunidades de recompra ----------
    const topRepurch = repurch
      .filter((r) => Number(r.confidence ?? 0) >= 0.6)
      .slice(0, 10);
    const repurchTotal = topRepurch.reduce((s, r) => s + Number(r.expected_value ?? 0), 0);
    if (repurchTotal > 0) {
      signals.push({
        key: "repurchase-window",
        tone: "opportunity",
        category: "recompra",
        title: `Janela de recompra: ${topRepurch.length} clientes prontos`,
        metric: brl(repurchTotal),
        reason: `IA identificou padrão de recompra com ≥60% confiança. Ative WhatsApp/visita esta semana.`,
        cta: { label: "Ver oportunidades", href: "/carteira" },
        impact_brl: Math.round(repurchTotal),
      });
    }

    // ---------- Inadimplência ----------
    const overdue = invoices
      .filter((i) => i.status !== "paid" && i.due_date && new Date(i.due_date).getTime() < now)
      .reduce((s, i) => s + Number(i.amount ?? 0), 0);
    if (overdue > 0) {
      const overdueCount = invoices.filter(
        (i) => i.status !== "paid" && i.due_date && new Date(i.due_date).getTime() < now,
      ).length;
      signals.push({
        key: "overdue",
        tone: "warn",
        category: "carteira",
        title: `${brl(overdue)} em cobrança vencida`,
        metric: `${overdueCount} faturas`,
        reason: "Regularizar cobrança libera limite e destrava novas vendas.",
        cta: { label: "Ver carteira", href: "/carteira" },
        impact_brl: Math.round(overdue),
      });
    }

    // ---------- Meta do período ----------
    if (goals[0]) {
      const target = Number(goals[0].target_value ?? 0);
      const won30 = deals
        .filter((d) => d.stage === "won" && d.closed_at && d.closed_at >= t30)
        .reduce((s, d) => s + Number(d.value ?? 0), 0);
      if (target > 0) {
        const pct = won30 / target;
        const gap = Math.max(0, target - won30);
        if (pct < 0.8) {
          signals.push({
            key: "goal-gap",
            tone: pct < 0.5 ? "critical" : "warn",
            category: "meta",
            title: `Meta em ${(pct * 100).toFixed(0)}% — faltam ${brl(gap)}`,
            metric: `${brl(won30)} / ${brl(target)}`,
            reason: "Priorize deals do pipeline com maior probabilidade e ticket.",
            cta: { label: "Abrir pipeline", href: "/pipeline" },
            impact_brl: Math.round(gap),
          });
        }
      }
    }

    // ---------- Cobertura fraca ----------
    const inactive = snap.filter((s) => (s.recency_days ?? 999) > 90).length;
    if (snap.length > 0 && inactive / snap.length > 0.4) {
      signals.push({
        key: "coverage-low",
        tone: "warn",
        category: "cobertura",
        title: `${inactive} clientes sem compra há +90 dias`,
        metric: `${((inactive / snap.length) * 100).toFixed(0)}% da carteira`,
        reason: "Roteirize visitas e disparos de WhatsApp para reativar carteira dormente.",
        cta: { label: "Planejar rota", href: "/geo-rota" },
      });
    }

    // ---------- Pipeline lento ----------
    const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    if (open.length > 0) {
      const stale = open.filter((d) => {
        const t = d.closed_at ? new Date(d.closed_at).getTime() : now;
        return now - t > 30 * DAY;
      }).length;
      if (stale > 0 && stale / open.length > 0.3) {
        signals.push({
          key: "pipeline-stale",
          tone: "info",
          category: "pipeline",
          title: `${stale} oportunidades paradas há +30d`,
          metric: `${((stale / open.length) * 100).toFixed(0)}% do pipeline`,
          reason: "Follow-up ou descarte libera foco em deals com maior chance.",
          cta: { label: "Revisar pipeline", href: "/pipeline" },
        });
      }
    }

    // ordenar: critical > warn > opportunity > info; dentro do tone, maior impacto primeiro
    const rank: Record<SignalTone, number> = { critical: 0, warn: 1, opportunity: 2, info: 3 };
    signals.sort((a, b) => {
      const r = rank[a.tone] - rank[b.tone];
      if (r !== 0) return r;
      return (b.impact_brl ?? 0) - (a.impact_brl ?? 0);
    });

    return { signals: signals.slice(0, 6), computed_at: new Date().toISOString() };
  });
