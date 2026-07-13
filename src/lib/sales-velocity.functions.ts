import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sales Velocity = (# oportunidades × ticket médio × win rate) / ciclo médio (dias)
 * Fórmula clássica de gestão comercial (Jason Lemkin / HubSpot).
 * Traduz para: "quanto R$ o pipeline produz por dia".
 * Compara janela atual vs janela anterior de mesmo tamanho.
 */
const Input = z.object({
  organization_id: z.string().uuid(),
  window_days: z.number().int().min(30).max(365).default(90),
});

export type SalesVelocity = {
  window_days: number;
  opportunities: number;
  avg_deal_value: number;
  win_rate: number; // 0..1
  cycle_days: number;
  velocity_per_day: number;
  prev: {
    velocity_per_day: number;
    opportunities: number;
    avg_deal_value: number;
    win_rate: number;
    cycle_days: number;
  };
  delta_pct: number | null; // vs período anterior
};

function computeWindow(deals: any[], from: Date, to: Date) {
  const created = deals.filter((d) => {
    const t = new Date(d.created_at).getTime();
    return t >= from.getTime() && t <= to.getTime();
  });
  const won = created.filter((d) => d.stage === "won");
  const closed = created.filter((d) => d.stage === "won" || d.stage === "lost");

  const wonValues = won.map((d) => Number(d.value ?? 0));
  const avg_deal_value = wonValues.length
    ? wonValues.reduce((a, b) => a + b, 0) / wonValues.length
    : 0;
  const win_rate = closed.length ? won.length / closed.length : 0;

  // ciclo médio: closed_at - created_at nos ganhos
  const cycles = won
    .map((d) => {
      if (!d.closed_at) return null;
      const days = (new Date(d.closed_at).getTime() - new Date(d.created_at).getTime()) / 86400000;
      return days > 0 ? days : null;
    })
    .filter((v): v is number => v != null);
  const cycle_days = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : 0;

  const opportunities = created.length;
  const velocity_per_day = cycle_days > 0 ? (opportunities * avg_deal_value * win_rate) / cycle_days : 0;

  return { opportunities, avg_deal_value, win_rate, cycle_days, velocity_per_day };
}

export const getSalesVelocity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<SalesVelocity> => {
    const { supabase } = context;
    const now = new Date();
    const wd = data.window_days;
    const curFrom = new Date(now.getTime() - wd * 86400000);
    const prevTo = curFrom;
    const prevFrom = new Date(curFrom.getTime() - wd * 86400000);

    const { data: rows, error } = await supabase
      .from("deals")
      .select("id, value, stage, created_at, closed_at")
      .eq("organization_id", data.organization_id)
      .gte("created_at", prevFrom.toISOString());
    if (error) throw new Error(error.message);
    const deals = rows ?? [];

    const cur = computeWindow(deals, curFrom, now);
    const prev = computeWindow(deals, prevFrom, prevTo);

    const delta_pct = prev.velocity_per_day > 0
      ? ((cur.velocity_per_day - prev.velocity_per_day) / prev.velocity_per_day) * 100
      : null;

    return {
      window_days: wd,
      opportunities: cur.opportunities,
      avg_deal_value: cur.avg_deal_value,
      win_rate: cur.win_rate,
      cycle_days: cur.cycle_days,
      velocity_per_day: cur.velocity_per_day,
      prev,
      delta_pct,
    };
  });
