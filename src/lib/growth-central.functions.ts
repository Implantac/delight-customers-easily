import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Central de Crescimento — "Plano do Dia" unificado.
 * Consolida em uma única chamada os 3 fluxos de ação comercial:
 *  • Prioritários: negócios abertos com maior score (valor × win-prob × urgência)
 *  • Em risco: clientes com churn ≥ 0,5 (recuperar receita)
 *  • Reativação: clientes com potencial de recompra > 0
 * Formato de saída padronizado (ActionItem) — o mesmo card renderiza todos.
 */

const DAY = 86400_000;
const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export type GrowthChannel = "visita" | "whatsapp" | "email" | "ligacao" | "campanha";
export type GrowthKind = "priority" | "risk" | "reactivation";

export type GrowthAction = {
  id: string;
  kind: GrowthKind;
  title: string;
  reason: string;
  subtitle?: string;
  impact_brl?: number;
  channel?: GrowthChannel;
  deadline?: string; // ISO or human label
  href: string;
  score?: number;
};

export type GrowthPlan = {
  priorities: GrowthAction[];
  risks: GrowthAction[];
  reactivations: GrowthAction[];
  totals: {
    priority_value: number;
    risk_value: number;
    reactivation_value: number;
  };
  computed_at: string;
};

export const getGrowthPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<GrowthPlan> => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();

    const safe = async <T,>(p: PromiseLike<T>, fallback: T): Promise<T> => {
      try { return await p; } catch { return fallback; }
    };

    const [dealsRes, insightsRes, churnRes, repurchRes, snapRes] = await Promise.all([
      safe(supabase.from("deals")
        .select("id, title, value, stage, expected_close, company_id, companies(name)")
        .eq("organization_id", org)
        .not("stage", "in", "(won,lost)")
        .order("value", { ascending: false })
        .limit(30), { data: [] as any[] } as any),
      safe(supabase.from("ai_deal_insights")
        .select("deal_id, win_probability")
        .eq("organization_id", org), { data: [] as any[] } as any),
      safe(supabase.from("ai_churn_predictions")
        .select("erp_customer_id, churn_probability, risk_level")
        .eq("organization_id", org)
        .gte("churn_probability", 0.5)
        .order("churn_probability", { ascending: false })
        .limit(20), { data: [] as any[] } as any),
      safe(supabase.from("ai_repurchase_predictions")
        .select("erp_customer_id, expected_value, expected_purchase_at, confidence")
        .eq("organization_id", org)
        .gt("expected_value", 0)
        .order("expected_value", { ascending: false })
        .limit(20), { data: [] as any[] } as any),
      safe(supabase.from("customer_360_snapshot")
        .select("erp_customer_id, display_name, monetary, recency_days, primary_phone, primary_email")
        .eq("organization_id", org), { data: [] as any[] } as any),
    ]);

    const deals = (dealsRes.data ?? []) as any[];
    const insights = new Map<string, number>();
    for (const i of (insightsRes.data ?? []) as any[]) {
      insights.set(String(i.deal_id), Number(i.win_probability ?? 0.5));
    }
    const churn = (churnRes.data ?? []) as any[];
    const repurch = (repurchRes.data ?? []) as any[];
    const snap = new Map<string, any>();
    for (const s of (snapRes.data ?? []) as any[]) {
      snap.set(String(s.erp_customer_id), s);
    }

    // ---------- Prioritários ----------
    const scored = deals.map((d) => {
      const winProb = insights.get(String(d.id)) ?? 0.5;
      const dayToClose = d.expected_close
        ? Math.max(0, (new Date(d.expected_close).getTime() - now) / DAY)
        : 30;
      const urgency = Math.max(0, 1 - dayToClose / 60);
      const val = Number(d.value ?? 0);
      const score = Math.round(winProb * 40 + urgency * 40 + Math.min(1, val / 100_000) * 20);
      return { d, score, winProb, dayToClose, val };
    }).sort((a, b) => b.score - a.score).slice(0, 5);

    const priorities: GrowthAction[] = scored.map(({ d, score, winProb, dayToClose, val }) => ({
      id: `p-${d.id}`,
      kind: "priority",
      title: d.title ?? "Negócio sem título",
      subtitle: d.companies?.name ?? "Empresa não vinculada",
      reason: `${Math.round(winProb * 100)}% chance · ${Math.round(dayToClose)}d restantes · ${d.stage}`,
      impact_brl: val,
      deadline: d.expected_close ?? undefined,
      channel: dayToClose < 3 ? "ligacao" : "whatsapp",
      href: "/pipeline",
      score,
    }));

    // ---------- Em risco ----------
    const risks: GrowthAction[] = churn.slice(0, 5).map((c) => {
      const s = snap.get(String(c.erp_customer_id));
      const name = s?.display_name ?? "Cliente sem nome";
      const monetary = Number(s?.monetary ?? 0);
      const prob = Number(c.churn_probability ?? 0);
      return {
        id: `r-${c.erp_customer_id}`,
        kind: "risk",
        title: `Recuperar ${name}`,
        subtitle: `Ticket histórico ${fmtBRL(monetary)}`,
        reason: `Risco ${Math.round(prob * 100)}% · silêncio ${s?.recency_days ?? "?"}d`,
        impact_brl: monetary,
        channel: s?.primary_phone ? "whatsapp" : s?.primary_email ? "email" : "visita",
        href: `/customer-360?id=${c.erp_customer_id}`,
      };
    });

    // ---------- Reativação (recompra) ----------
    const reactivations: GrowthAction[] = repurch.slice(0, 5).map((r) => {
      const s = snap.get(String(r.erp_customer_id));
      const name = s?.display_name ?? "Cliente sem nome";
      const exp = Number(r.expected_value ?? 0);
      const conf = Number(r.confidence ?? 0);
      const when = r.expected_purchase_at ? new Date(r.expected_purchase_at) : null;
      return {
        id: `x-${r.erp_customer_id}`,
        kind: "reactivation",
        title: `Abordar ${name}`,
        subtitle: when
          ? `Janela ~${when.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
          : "Janela ideal aberta",
        reason: `Recompra prevista ${fmtBRL(exp)} · confiança ${Math.round(conf * 100)}%`,
        impact_brl: exp,
        channel: s?.primary_phone ? "whatsapp" : "email",
        deadline: r.expected_purchase_at ?? undefined,
        href: `/customer-360?id=${r.erp_customer_id}`,
      };
    });

    return {
      priorities,
      risks,
      reactivations,
      totals: {
        priority_value: priorities.reduce((s, a) => s + (a.impact_brl ?? 0), 0),
        risk_value: risks.reduce((s, a) => s + (a.impact_brl ?? 0), 0),
        reactivation_value: reactivations.reduce((s, a) => s + (a.impact_brl ?? 0), 0),
      },
      computed_at: new Date().toISOString(),
    };
  });
