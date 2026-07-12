import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Painel analítico do gestor.
 * Consolida numa chamada:
 *  • Funil por estágio (contagem + valor + conversão inter-estágio, últimos N dias)
 *  • Sales velocity: (oportunidades abertas × ticket médio × win rate) / ciclo médio
 *  • Cobertura de meta do período (mês corrente): meta vs. ganho + pipeline ponderado
 */
const STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_WEIGHTS: Record<Stage, number> = {
  lead: 0.1,
  qualified: 0.25,
  proposal: 0.5,
  negotiation: 0.75,
  won: 1,
  lost: 0,
};

const input = z.object({
  organization_id: z.string().uuid(),
  days: z.number().int().min(7).max(720).default(90),
});

export const getSalesAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

    const [allDealsRes, monthWonRes, goalsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, stage, value, created_at, closed_at")
        .eq("organization_id", data.organization_id)
        .gte("created_at", since)
        .limit(10000),
      supabase
        .from("deals")
        .select("id, value")
        .eq("organization_id", data.organization_id)
        .eq("stage", "won")
        .gte("closed_at", monthStart.toISOString())
        .lt("closed_at", monthEnd.toISOString()),
      supabase
        .from("sales_goals")
        .select("target_value, period_month, user_id")
        .eq("organization_id", data.organization_id)
        .gte("period_month", monthStart.toISOString().slice(0, 10))
        .lt("period_month", monthEnd.toISOString().slice(0, 10)),
    ]);
    if (allDealsRes.error) throw new Error(allDealsRes.error.message);
    if (monthWonRes.error) throw new Error(monthWonRes.error.message);
    if (goalsRes.error) throw new Error(goalsRes.error.message);

    const deals = (allDealsRes.data ?? []) as Array<{
      id: string; stage: Stage; value: number | null;
      created_at: string; closed_at: string | null;
    }>;

    // Funil por estágio
    const funnel = STAGES.map((s) => {
      const rows = deals.filter((d) => d.stage === s);
      const value = rows.reduce((acc, d) => acc + Number(d.value ?? 0), 0);
      return { stage: s, count: rows.length, value };
    });
    const won = funnel.find((f) => f.stage === "won")!;
    const lost = funnel.find((f) => f.stage === "lost")!;
    const totalClosed = won.count + lost.count;
    const winRate = totalClosed ? won.count / totalClosed : 0;

    // Pipeline aberto (contagem + valor + valor ponderado)
    const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const openValue = open.reduce((s, d) => s + Number(d.value ?? 0), 0);
    const weighted = open.reduce(
      (s, d) => s + Number(d.value ?? 0) * (STAGE_WEIGHTS[d.stage] ?? 0.3),
      0,
    );
    const avgTicket = open.length ? openValue / open.length : 0;

    // Ciclo médio (dias em que fechou como won)
    const cycles = deals
      .filter((d) => d.stage === "won" && d.closed_at)
      .map((d) => (new Date(d.closed_at!).getTime() - new Date(d.created_at).getTime()) / 86400_000)
      .filter((n) => n > 0);
    const avgCycleDays = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : 0;

    // Sales velocity = (# opps × ticket × winRate) / ciclo. R$/dia esperado.
    const salesVelocity =
      avgCycleDays > 0 ? (open.length * avgTicket * winRate) / avgCycleDays : 0;

    // Cobertura da meta do mês
    const monthWonValue = (monthWonRes.data ?? []).reduce(
      (s, d) => s + Number(d.value ?? 0),
      0,
    );
    const monthTarget = (goalsRes.data ?? []).reduce(
      (s, g) => s + Number(g.target_value ?? 0),
      0,
    );
    const attainment = monthTarget > 0 ? monthWonValue / monthTarget : 0;
    const gap = Math.max(0, monthTarget - monthWonValue);
    // "Preciso vender X/dia no restante para bater a meta"
    const today = new Date();
    const daysLeft = Math.max(
      1,
      Math.ceil((monthEnd.getTime() - today.getTime()) / 86400_000),
    );
    const dailyPace = gap / daysLeft;

    return {
      funnel,
      winRate,
      openCount: open.length,
      openValue,
      weightedPipeline: weighted,
      avgTicket,
      avgCycleDays: Math.round(avgCycleDays),
      salesVelocity,
      monthWonValue,
      monthTarget,
      attainment,
      gap,
      daysLeft,
      dailyPace,
      periodDays: data.days,
    };
  });
