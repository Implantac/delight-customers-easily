import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Inteligência Comercial — responde as 7 perguntas-chave do CRM Enterprise:
 *  1. Quem vende mais?         (rep ranking — top)
 *  2. Quem vende menos?        (rep ranking — bottom, ativos)
 *  3. Quem devo visitar hoje?  (prioridade: churn + recency + ticket)
 *  4. Quais clientes têm potencial?  (ai_repurchase_predictions)
 *  5. Quais clientes estão em risco? (ai_churn_predictions)
 *  6. Quais regiões têm oportunidade? (get_regional_sales_rollup)
 *  7. Quais campanhas funcionam melhor? (email_campaigns aggregate)
 *
 * Tudo somente leitura. Nunca cria/edita entidades operacionais do ERP.
 */

const Input = z.object({
  organization_id: z.string().uuid(),
  days: z.number().int().min(7).max(365).default(90),
  limit: z.number().int().min(3).max(50).default(10),
});

export type CommercialIntel = {
  topReps: Array<{ user_id: string; full_name: string | null; revenue: number; orders: number }>;
  bottomReps: Array<{ user_id: string; full_name: string | null; revenue: number; orders: number }>;
  visitToday: Array<{
    erp_customer_id: string;
    company_id: string | null;
    display_name: string | null;
    recency_days: number | null;
    monetary: number | null;
    churn_probability: number | null;
    score: number;
  }>;
  highPotential: Array<{
    erp_customer_id: string;
    display_name: string | null;
    expected_value: number | null;
    confidence: number | null;
    expected_purchase_at: string | null;
  }>;
  churnRisk: Array<{
    erp_customer_id: string;
    display_name: string | null;
    churn_probability: number;
    risk_level: string | null;
    monetary: number | null;
  }>;
  regionalOpps: Array<{
    state: string | null;
    city: string | null;
    customers: number;
    orders: number;
    revenue: number;
  }>;
  topCampaigns: Array<{
    id: string;
    name: string;
    sent: number;
    opened: number;
    clicked: number;
    open_rate: number;
    click_rate: number;
  }>;
  generated_at: string;
};

export const getCommercialIntel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<CommercialIntel> => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    // ---------- 1 & 2: Rep ranking (top + bottom) -----------------------
    // Agrega vendas por sales_rep_external_id e tenta resolver para user.
    const { data: salesAgg } = await supabase
      .from("erp_sales_history")
      .select("sales_rep_external_id, total_value")
      .eq("organization_id", data.organization_id)
      .gte("order_date", since)
      .not("sales_rep_external_id", "is", null);

    const repMap = new Map<string, { revenue: number; orders: number }>();
    for (const row of salesAgg ?? []) {
      const k = row.sales_rep_external_id as string | null;
      if (!k) continue;
      const cur = repMap.get(k) ?? { revenue: 0, orders: 0 };
      cur.revenue += Number(row.total_value ?? 0);
      cur.orders += 1;
      repMap.set(k, cur);
    }

    // Tenta resolver external_id → user (via memberships.metadata se existir).
    // Como fallback, usa o próprio external_id como rótulo.
    const repIds = [...repMap.keys()];
    const repNameMap = new Map<string, string>();
    if (repIds.length) {
      const { data: reps } = await supabase
        .from("sales_reps")
        .select("external_id, name")
        .eq("organization_id", data.organization_id)
        .in("external_id", repIds);
      for (const r of reps ?? []) {
        if (r.external_id) repNameMap.set(r.external_id, (r as any).name ?? r.external_id);
      }
    }

    const repsRanked = repIds
      .map((id) => ({
        user_id: id,
        full_name: repNameMap.get(id) ?? id,
        revenue: repMap.get(id)!.revenue,
        orders: repMap.get(id)!.orders,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const topReps = repsRanked.slice(0, data.limit);
    const bottomReps = repsRanked
      .filter((r) => r.orders > 0)
      .slice(-data.limit)
      .reverse();

    // ---------- 5: Churn risk (alimenta também o visitToday) --------------
    const { data: churn } = await supabase
      .from("ai_churn_predictions")
      .select("erp_customer_id, churn_probability, risk_level")
      .eq("organization_id", data.organization_id)
      .order("churn_probability", { ascending: false })
      .limit(200);

    const churnMap = new Map<string, { p: number; level: string | null }>();
    for (const c of churn ?? []) {
      churnMap.set(c.erp_customer_id as string, {
        p: Number(c.churn_probability ?? 0),
        level: c.risk_level as string | null,
      });
    }

    // ---------- 3: Visit priority -----------------------------------------
    const { data: snap } = await supabase
      .from("customer_360_snapshot")
      .select("erp_customer_id, company_id, display_name, recency_days, monetary")
      .eq("organization_id", data.organization_id)
      .order("monetary", { ascending: false })
      .limit(500);

    const visitToday = (snap ?? [])
      .map((s) => {
        const ch = churnMap.get(s.erp_customer_id as string);
        const rec = Number(s.recency_days ?? 0);
        const mon = Number(s.monetary ?? 0);
        const p = ch?.p ?? 0;
        // score: risco de churn pesa 60%, recência 25%, valor 15%
        const recScore = Math.min(1, rec / 180);
        const monScore = mon > 0 ? Math.min(1, Math.log10(mon + 1) / 6) : 0;
        const score = p * 0.6 + recScore * 0.25 + monScore * 0.15;
        return {
          erp_customer_id: s.erp_customer_id as string,
          company_id: (s.company_id as string | null) ?? null,
          display_name: (s.display_name as string | null) ?? null,
          recency_days: (s.recency_days as number | null) ?? null,
          monetary: (s.monetary as number | null) ?? null,
          churn_probability: ch?.p ?? null,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, data.limit);

    // ---------- 4: High potential (repurchase) ----------------------------
    const { data: repurchase } = await supabase
      .from("ai_repurchase_predictions")
      .select("erp_customer_id, expected_value, confidence, expected_purchase_at")
      .eq("organization_id", data.organization_id)
      .order("expected_value", { ascending: false })
      .limit(data.limit);

    const custIds = [
      ...new Set([
        ...(repurchase ?? []).map((r) => r.erp_customer_id as string),
        ...(churn ?? []).slice(0, data.limit).map((c) => c.erp_customer_id as string),
      ]),
    ];
    const nameMap = new Map<string, string | null>();
    const monMap = new Map<string, number | null>();
    if (custIds.length) {
      const { data: names } = await supabase
        .from("customer_360_snapshot")
        .select("erp_customer_id, display_name, monetary")
        .eq("organization_id", data.organization_id)
        .in("erp_customer_id", custIds);
      for (const n of names ?? []) {
        nameMap.set(n.erp_customer_id as string, (n.display_name as string | null) ?? null);
        monMap.set(n.erp_customer_id as string, (n.monetary as number | null) ?? null);
      }
    }

    const highPotential = (repurchase ?? []).map((r) => ({
      erp_customer_id: r.erp_customer_id as string,
      display_name: nameMap.get(r.erp_customer_id as string) ?? null,
      expected_value: (r.expected_value as number | null) ?? null,
      confidence: (r.confidence as number | null) ?? null,
      expected_purchase_at: (r.expected_purchase_at as string | null) ?? null,
    }));

    const churnRisk = (churn ?? []).slice(0, data.limit).map((c) => ({
      erp_customer_id: c.erp_customer_id as string,
      display_name: nameMap.get(c.erp_customer_id as string) ?? null,
      churn_probability: Number(c.churn_probability ?? 0),
      risk_level: (c.risk_level as string | null) ?? null,
      monetary: monMap.get(c.erp_customer_id as string) ?? null,
    }));

    // ---------- 6: Regional opportunities (RPC já existe) -----------------
    let regionalOpps: CommercialIntel["regionalOpps"] = [];
    try {
      const { data: regional } = await (supabase as any).rpc("get_regional_sales_rollup", {
        _org: data.organization_id,
        _days: data.days,
      });
      regionalOpps = (regional ?? []).slice(0, data.limit).map((r: any) => ({
        state: r.state ?? null,
        city: r.city ?? null,
        customers: Number(r.customers ?? 0),
        orders: Number(r.orders ?? 0),
        revenue: Number(r.revenue ?? 0),
      }));
    } catch {
      regionalOpps = [];
    }

    // ---------- 7: Campanhas que funcionam -------------------------------
    const { data: camps } = await supabase
      .from("email_campaigns")
      .select("id, name, total_sent, total_opened, total_clicked, sent_at")
      .eq("organization_id", data.organization_id)
      .not("sent_at", "is", null)
      .gte("sent_at", since)
      .order("total_clicked", { ascending: false })
      .limit(data.limit);

    const topCampaigns = (camps ?? []).map((c) => {
      const sent = Number(c.total_sent ?? 0);
      const opened = Number(c.total_opened ?? 0);
      const clicked = Number(c.total_clicked ?? 0);
      return {
        id: c.id as string,
        name: (c.name as string) ?? "(sem nome)",
        sent,
        opened,
        clicked,
        open_rate: sent > 0 ? opened / sent : 0,
        click_rate: sent > 0 ? clicked / sent : 0,
      };
    });

    return {
      topReps,
      bottomReps,
      visitToday,
      highPotential,
      churnRisk,
      regionalOpps,
      topCampaigns,
      generated_at: new Date().toISOString(),
    };
  });

/**
 * Next Best Action — combina churn + recompra + última atividade
 * para um cliente específico e devolve recomendação textual + CTA.
 */
const NbaInput = z.object({
  organization_id: z.string().uuid(),
  erp_customer_id: z.string().uuid(),
});

export type NextBestAction = {
  action: "visit" | "call" | "whatsapp" | "email" | "offer" | "monitor";
  priority: "high" | "medium" | "low";
  reason: string;
  cta: string;
  context: {
    churn_probability: number | null;
    expected_value: number | null;
    last_purchase_at: string | null;
    last_activity_at: string | null;
  };
};

export const getNextBestAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NbaInput.parse(d))
  .handler(async ({ data, context }): Promise<NextBestAction> => {
    const { supabase } = context;

    const [snapRes, churnRes, repRes] = await Promise.all([
      supabase
        .from("customer_360_snapshot")
        .select("display_name, last_purchase_at, last_activity_at, has_whatsapp, has_email, recency_days, monetary")
        .eq("organization_id", data.organization_id)
        .eq("erp_customer_id", data.erp_customer_id)
        .maybeSingle(),
      supabase
        .from("ai_churn_predictions")
        .select("churn_probability, risk_level")
        .eq("organization_id", data.organization_id)
        .eq("erp_customer_id", data.erp_customer_id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("ai_repurchase_predictions")
        .select("expected_value, expected_purchase_at, confidence")
        .eq("organization_id", data.organization_id)
        .eq("erp_customer_id", data.erp_customer_id)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const snap = snapRes.data;
    const churn = churnRes.data;
    const rep = repRes.data;

    const churnP = Number(churn?.churn_probability ?? 0);
    const expVal = Number(rep?.expected_value ?? 0);
    const recency = Number(snap?.recency_days ?? 0);
    const hasWa = !!snap?.has_whatsapp;
    const hasEm = !!snap?.has_email;

    let action: NextBestAction["action"] = "monitor";
    let priority: NextBestAction["priority"] = "low";
    let reason = "Sem sinais relevantes no momento.";
    let cta = "Acompanhar próximos 30 dias.";

    if (churnP >= 0.7) {
      action = "visit";
      priority = "high";
      reason = `Risco alto de churn (${(churnP * 100).toFixed(0)}%) e ${recency || 0} dias sem comprar.`;
      cta = "Agendar visita esta semana para recuperar o cliente.";
    } else if (churnP >= 0.4 && hasWa) {
      action = "whatsapp";
      priority = "medium";
      reason = `Risco moderado (${(churnP * 100).toFixed(0)}%) — toque por WhatsApp tende a converter.`;
      cta = "Enviar mensagem personalizada de reativação.";
    } else if (expVal > 0 && (rep?.confidence ?? 0) >= 0.5) {
      action = "offer";
      priority = "high";
      reason = `Janela de recompra aberta (~R$ ${Math.round(expVal).toLocaleString("pt-BR")} previsto).`;
      cta = "Enviar proposta com mix sugerido antes da data prevista.";
    } else if (recency > 60 && hasEm) {
      action = "email";
      priority = "medium";
      reason = `${recency} dias sem compra — bom momento para reengajar por e-mail.`;
      cta = "Disparar campanha de reativação segmentada.";
    } else if (recency > 30) {
      action = "call";
      priority = "low";
      reason = `${recency} dias sem contato — manter relacionamento.`;
      cta = "Ligar para checar satisfação e identificar necessidades.";
    }

    return {
      action,
      priority,
      reason,
      cta,
      context: {
        churn_probability: churn ? Number(churn.churn_probability) : null,
        expected_value: rep?.expected_value as number | null,
        last_purchase_at: (snap?.last_purchase_at as string | null) ?? null,
        last_activity_at: (snap?.last_activity_at as string | null) ?? null,
      },
    };
  });
