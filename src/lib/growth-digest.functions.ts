import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Growth Digest — relatório executivo semanal consolidado.
 * Combina USE Success delta, vitórias/perdas da semana, sinais críticos
 * e foco recomendado. Pensado para segunda de manhã: o time abre e sabe
 * onde atacar na semana.
 */

const DAY = 86400_000;
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number) => `${Math.round(n * 100)}%`;

export type DigestHighlight = {
  tone: "positive" | "negative" | "neutral";
  title: string;
  metric: string;
  detail: string;
};

export type DigestFocus = {
  priority: 1 | 2 | 3;
  title: string;
  reason: string;
  href?: string;
  impact_brl?: number;
};

export type GrowthDigest = {
  period: { start: string; end: string; label: string };
  score: { current: number | null; previous: number | null; delta: number };
  headline: string;
  narrative: string;
  revenue: { won: number; won_prev: number; growth: number; open_pipeline: number };
  wins: { count: number; total: number; top: { title: string; value: number }[] };
  losses: { count: number; total: number };
  highlights: DigestHighlight[];
  focus: DigestFocus[];
  computed_at: string;
};

export const getGrowthDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      organization_id: z.string().uuid(),
      weeks_back: z.number().int().min(0).max(12).default(0),
    }).parse(i),
  )
  .handler(async ({ data, context }): Promise<GrowthDigest> => {
    const { supabase } = context;
    const org = data.organization_id;

    const now = Date.now();
    const endMs = now - data.weeks_back * 7 * DAY;
    const startMs = endMs - 7 * DAY;
    const prevStartMs = startMs - 7 * DAY;
    const start = new Date(startMs).toISOString();
    const end = new Date(endMs).toISOString();
    const prevStart = new Date(prevStartMs).toISOString();

    const safe = async <T,>(p: PromiseLike<T>, fallback: T): Promise<T> => {
      try { return await p; } catch { return fallback; }
    };

    const [dealsRes, snapsRes, churnRes, invRes] = await Promise.all([
      safe(supabase.from("deals")
        .select("id, title, value, stage, closed_at")
        .eq("organization_id", org)
        .gte("closed_at", prevStart)
        .lte("closed_at", end), { data: [] as any[] } as any),
      safe(supabase.from("use_success_snapshots")
        .select("score, classification, computed_at")
        .eq("organization_id", org)
        .order("computed_at", { ascending: false })
        .limit(30), { data: [] as any[] } as any),
      safe(supabase.from("ai_churn_predictions")
        .select("churn_probability")
        .eq("organization_id", org), { data: [] as any[] } as any),
      safe(supabase.from("invoices")
        .select("amount, status, due_date")
        .eq("organization_id", org), { data: [] as any[] } as any),
    ]);

    const deals = (dealsRes.data ?? []) as any[];
    const snaps = (snapsRes.data ?? []) as any[];
    const churn = (churnRes.data ?? []) as any[];
    const invoices = (invRes.data ?? []) as any[];

    const openPipeline = deals
      .filter((d) => d.stage !== "won" && d.stage !== "lost")
      .reduce((s, d) => s + Number(d.value ?? 0), 0);

    const wonWeek = deals.filter(
      (d) => d.stage === "won" && d.closed_at && d.closed_at >= start && d.closed_at <= end,
    );
    const wonPrev = deals.filter(
      (d) => d.stage === "won" && d.closed_at && d.closed_at >= prevStart && d.closed_at < start,
    );
    const lostWeek = deals.filter(
      (d) => d.stage === "lost" && d.closed_at && d.closed_at >= start && d.closed_at <= end,
    );

    const wonTotal = wonWeek.reduce((s, d) => s + Number(d.value ?? 0), 0);
    const wonPrevTotal = wonPrev.reduce((s, d) => s + Number(d.value ?? 0), 0);
    const lostTotal = lostWeek.reduce((s, d) => s + Number(d.value ?? 0), 0);
    const growth = wonPrevTotal > 0 ? (wonTotal - wonPrevTotal) / wonPrevTotal : wonTotal > 0 ? 1 : 0;

    const topWins = wonWeek
      .slice()
      .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
      .slice(0, 3)
      .map((d) => ({ title: String(d.title ?? "Negócio"), value: Number(d.value ?? 0) }));

    // Score atual/anterior a partir dos snapshots
    const inRange = snaps.filter((s) => s.computed_at >= start && s.computed_at <= end);
    const prevRange = snaps.filter((s) => s.computed_at >= prevStart && s.computed_at < start);
    const current = inRange.length ? Number(inRange[0].score) : snaps[0] ? Number(snaps[0].score) : null;
    const previous = prevRange.length ? Number(prevRange[0].score) : null;
    const scoreDelta = current !== null && previous !== null ? current - previous : 0;

    // Highlights
    const highlights: DigestHighlight[] = [];
    if (wonWeek.length) {
      highlights.push({
        tone: growth >= 0 ? "positive" : "negative",
        title: `${wonWeek.length} negócio${wonWeek.length === 1 ? "" : "s"} fechado${wonWeek.length === 1 ? "" : "s"}`,
        metric: brl(wonTotal),
        detail: wonPrevTotal > 0
          ? `${growth >= 0 ? "+" : ""}${pct(growth)} vs. semana anterior (${brl(wonPrevTotal)}).`
          : "Sem base de comparação na semana anterior.",
      });
    } else {
      highlights.push({
        tone: "negative",
        title: "Nenhum fechamento na semana",
        metric: brl(0),
        detail: `Pipeline aberto de ${brl(openPipeline)} aguarda ação.`,
      });
    }

    if (lostWeek.length) {
      highlights.push({
        tone: "negative",
        title: `${lostWeek.length} perda${lostWeek.length === 1 ? "" : "s"}`,
        metric: brl(lostTotal),
        detail: "Revisar motivos e reengajar quem ainda tem fit.",
      });
    }

    const criticalChurn = churn.filter((c) => Number(c.churn_probability ?? 0) >= 0.7).length;
    if (criticalChurn > 0) {
      highlights.push({
        tone: "negative",
        title: `${criticalChurn} cliente${criticalChurn === 1 ? "" : "s"} em risco crítico`,
        metric: `${criticalChurn} contas`,
        detail: "Probabilidade de churn ≥ 70% detectada pela IA.",
      });
    }

    const overdue = invoices
      .filter((i) => i.status !== "paid" && i.due_date && new Date(i.due_date).getTime() < now)
      .reduce((s, i) => s + Number(i.amount ?? 0), 0);
    if (overdue > 0) {
      highlights.push({
        tone: "negative",
        title: "Carteira vencida",
        metric: brl(overdue),
        detail: "Valor em aberto que precisa de régua de cobrança.",
      });
    }

    if (current !== null && previous !== null) {
      highlights.push({
        tone: scoreDelta >= 0 ? "positive" : "negative",
        title: `USE Success ${scoreDelta >= 0 ? "subiu" : "caiu"} ${Math.abs(scoreDelta)} pts`,
        metric: `${current}/100`,
        detail: `Semana anterior: ${previous}/100.`,
      });
    }

    // Focus (top 3 ações da semana)
    const focus: DigestFocus[] = [];
    if (openPipeline > 0 && wonTotal < wonPrevTotal * 0.8) {
      focus.push({
        priority: 1,
        title: "Acelerar fechamentos de alto valor",
        reason: `Pipeline de ${brl(openPipeline)} aberto e receita 20%+ abaixo da semana anterior.`,
        href: "/pipeline",
        impact_brl: openPipeline * 0.25,
      });
    }
    if (criticalChurn > 0) {
      focus.push({
        priority: focus.length === 0 ? 1 : 2,
        title: `Reter ${criticalChurn} conta${criticalChurn === 1 ? "" : "s"} em risco crítico`,
        reason: "IA aponta ≥70% de probabilidade de churn — ação humana ainda muda o desfecho.",
        href: "/inteligencia-comercial",
      });
    }
    if (overdue > 0) {
      focus.push({
        priority: (focus.length + 1) as 1 | 2 | 3,
        title: `Regularizar ${brl(overdue)} de carteira`,
        reason: "Cobrança destravada libera fôlego comercial e reduz risco.",
        href: "/carteira",
        impact_brl: overdue,
      });
    }
    if (focus.length === 0) {
      focus.push({
        priority: 1,
        title: "Ampliar cobertura da carteira",
        reason: "Semana estável — hora de prospectar e visitar clientes não tocados.",
        href: "/geo-cobertura",
      });
    }

    const headline =
      scoreDelta > 2
        ? `Semana positiva: score subiu ${scoreDelta} pts e ${wonWeek.length} negócio(s) fechado(s).`
        : scoreDelta < -2
          ? `Atenção: score caiu ${Math.abs(scoreDelta)} pts — foco nas ações abaixo.`
          : wonWeek.length > 0
            ? `${brl(wonTotal)} fechado(s) na semana em ${wonWeek.length} negócio(s).`
            : "Semana sem fechamentos — o foco desta semana está na conversão do pipeline.";

    const narrative = [
      `Entre ${new Date(start).toLocaleDateString("pt-BR")} e ${new Date(end).toLocaleDateString("pt-BR")}, `,
      `o time fechou ${brl(wonTotal)} em ${wonWeek.length} negócio(s)`,
      wonPrevTotal > 0 ? ` (${growth >= 0 ? "+" : ""}${pct(growth)} vs semana anterior)` : "",
      lostWeek.length ? ` e perdeu ${brl(lostTotal)} em ${lostWeek.length} negócio(s)` : "",
      `. Pipeline aberto é de ${brl(openPipeline)}`,
      criticalChurn > 0 ? ` e ${criticalChurn} cliente(s) estão em risco crítico de churn` : "",
      ".",
    ].join("");

    const label = data.weeks_back === 0
      ? "Semana atual"
      : data.weeks_back === 1
        ? "Semana passada"
        : `${data.weeks_back} semanas atrás`;

    return {
      period: { start, end, label },
      score: { current, previous, delta: scoreDelta },
      headline,
      narrative,
      revenue: { won: wonTotal, won_prev: wonPrevTotal, growth, open_pipeline: openPipeline },
      wins: { count: wonWeek.length, total: wonTotal, top: topWins },
      losses: { count: lostWeek.length, total: lostTotal },
      highlights,
      focus,
      computed_at: new Date().toISOString(),
    };
  });
