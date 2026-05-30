import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({
  organization_id: z.string().uuid(),
  days: z.number().int().min(7).max(720).default(180),
});

export const getWinLossIntel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    const { data: deals, error } = await supabase
      .from("deals")
      .select("id, title, value, stage, outcome_reason, outcome_notes, closed_at, user_id, company_id, created_at")
      .eq("organization_id", data.organization_id)
      .in("stage", ["won", "lost"])
      .gte("closed_at", since)
      .order("closed_at", { ascending: false });
    if (error) throw error;

    const rows = deals ?? [];
    const won = rows.filter((d) => d.stage === "won");
    const lost = rows.filter((d) => d.stage === "lost");
    const wonValue = won.reduce((s, d) => s + Number(d.value || 0), 0);
    const lostValue = lost.reduce((s, d) => s + Number(d.value || 0), 0);
    const winRate = rows.length ? won.length / rows.length : 0;

    // Aggregations by reason
    const byReason = new Map<string, { reason: string; outcome: "won" | "lost"; count: number; value: number }>();
    for (const d of rows) {
      const key = `${d.stage}::${d.outcome_reason ?? "Sem motivo"}`;
      const cur = byReason.get(key) ?? {
        reason: d.outcome_reason ?? "Sem motivo",
        outcome: d.stage as "won" | "lost",
        count: 0,
        value: 0,
      };
      cur.count += 1;
      cur.value += Number(d.value || 0);
      byReason.set(key, cur);
    }
    const reasons = Array.from(byReason.values()).sort((a, b) => b.value - a.value);

    // Sales cycle (days from created to closed) on won
    const cycles = won
      .filter((d) => d.closed_at && d.created_at)
      .map((d) => (new Date(d.closed_at!).getTime() - new Date(d.created_at).getTime()) / 86400_000);
    const avgCycle = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : 0;

    // Per-user performance
    const byUser = new Map<string, { user_id: string; won: number; lost: number; wonValue: number; lostValue: number }>();
    for (const d of rows) {
      const uid = d.user_id ?? "—";
      const cur = byUser.get(uid) ?? { user_id: uid, won: 0, lost: 0, wonValue: 0, lostValue: 0 };
      if (d.stage === "won") { cur.won++; cur.wonValue += Number(d.value || 0); }
      else { cur.lost++; cur.lostValue += Number(d.value || 0); }
      byUser.set(uid, cur);
    }
    const userIds = Array.from(byUser.keys()).filter((u) => u !== "—");
    let profiles: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      profiles = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name ?? "—"]));
    }
    const userPerf = Array.from(byUser.values())
      .map((u) => ({
        ...u,
        name: profiles[u.user_id] ?? "—",
        winRate: u.won + u.lost ? u.won / (u.won + u.lost) : 0,
      }))
      .sort((a, b) => b.wonValue - a.wonValue);

    // Top insight (most expensive loss reason)
    const lossReasons = reasons.filter((r) => r.outcome === "lost");
    const topLossReason = lossReasons[0] ?? null;

    return {
      summary: {
        total: rows.length,
        wonCount: won.length,
        lostCount: lost.length,
        winRate,
        wonValue,
        lostValue,
        avgCycleDays: Math.round(avgCycle),
      },
      reasons,
      userPerf,
      topLossReason,
      recentDeals: rows.slice(0, 30),
    };
  });

const updateInput = z.object({
  deal_id: z.string().uuid(),
  outcome_reason: z.string().max(120).nullable(),
  outcome_notes: z.string().max(2000).nullable(),
});

export const updateDealOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("deals")
      .update({
        outcome_reason: data.outcome_reason,
        outcome_notes: data.outcome_notes,
      })
      .eq("id", data.deal_id);
    if (error) throw error;
    return { ok: true };
  });
