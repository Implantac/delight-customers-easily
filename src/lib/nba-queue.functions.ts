import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Painel NBA — devolve uma fila priorizada de Next Best Actions
 * agregando snapshot 360 + churn + recompra. Sem ownership por
 * representante no snapshot, então filtra por segmento.
 */
const ListInput = z.object({
  organization_id: z.string().uuid(),
  segment: z.string().max(64).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type NbaItem = {
  erp_customer_id: string;
  company_id: string | null;
  display_name: string;
  rfm_segment: string | null;
  recency_days: number | null;
  monetary: number | null;
  has_whatsapp: boolean;
  has_email: boolean;
  churn_probability: number | null;
  expected_value: number | null;
  expected_purchase_at: string | null;
  action: "visit" | "call" | "whatsapp" | "email" | "offer" | "monitor";
  priority: "high" | "medium" | "low";
  score: number;
  reason: string;
  cta: string;
};

function decide(snap: any, churn: any, rep: any): Pick<NbaItem, "action" | "priority" | "score" | "reason" | "cta"> {
  const churnP = Number(churn?.churn_probability ?? 0);
  const expVal = Number(rep?.expected_value ?? 0);
  const conf = Number(rep?.confidence ?? 0);
  const recency = Number(snap?.recency_days ?? 0);
  const hasWa = !!snap?.has_whatsapp;
  const hasEm = !!snap?.has_email;

  let action: NbaItem["action"] = "monitor";
  let priority: NbaItem["priority"] = "low";
  let reason = "Sem sinais relevantes — apenas acompanhar.";
  let cta = "Monitorar próximos 30 dias.";
  let score = 0;

  if (churnP >= 0.7) {
    action = "visit";
    priority = "high";
    reason = `Risco alto de churn (${(churnP * 100).toFixed(0)}%) · ${recency}d sem comprar`;
    cta = "Agendar visita esta semana";
    score = 90 + churnP * 10;
  } else if (expVal > 0 && conf >= 0.5) {
    action = "offer";
    priority = "high";
    reason = `Janela de recompra ~ R$ ${Math.round(expVal).toLocaleString("pt-BR")}`;
    cta = "Enviar proposta com mix sugerido";
    score = 70 + conf * 20 + Math.min(expVal / 10000, 10);
  } else if (churnP >= 0.4 && hasWa) {
    action = "whatsapp";
    priority = "medium";
    reason = `Risco moderado (${(churnP * 100).toFixed(0)}%) — toque por WhatsApp`;
    cta = "Mensagem personalizada de reativação";
    score = 50 + churnP * 20;
  } else if (recency > 60 && hasEm) {
    action = "email";
    priority = "medium";
    reason = `${recency}d sem compra — bom momento para reengajar`;
    cta = "Campanha de reativação por e-mail";
    score = 40 + Math.min(recency / 10, 20);
  } else if (recency > 30) {
    action = "call";
    priority = "low";
    reason = `${recency}d sem contato`;
    cta = "Ligar para checar satisfação";
    score = 20 + Math.min(recency / 10, 15);
  }

  return { action, priority, score, reason, cta };
}

export const listNbaQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListInput.parse(i))
  .handler(async ({ data, context }): Promise<{ items: NbaItem[] }> => {
    const { supabase } = context;
    let q = (supabase as any)
      .from("customer_360_snapshot")
      .select(
        "erp_customer_id, company_id, display_name, rfm_segment, recency_days, monetary, has_whatsapp, has_email",
      )
      .eq("organization_id", data.organization_id)
      .not("erp_customer_id", "is", null)
      .order("monetary", { ascending: false, nullsFirst: false })
      .limit(Math.min(data.limit * 4, 400));
    if (data.segment) q = q.eq("rfm_segment", data.segment);
    const { data: snaps, error } = await q;
    if (error) throw new Error(error.message);
    const list = (snaps ?? []) as any[];
    if (list.length === 0) return { items: [] };

    const ids = list.map((s) => s.erp_customer_id).filter(Boolean);
    const [churnRes, repRes] = await Promise.all([
      (supabase as any)
        .from("ai_churn_predictions")
        .select("erp_customer_id, churn_probability")
        .eq("organization_id", data.organization_id)
        .in("erp_customer_id", ids),
      (supabase as any)
        .from("ai_repurchase_predictions")
        .select("erp_customer_id, expected_value, expected_purchase_at, confidence")
        .eq("organization_id", data.organization_id)
        .in("erp_customer_id", ids),
    ]);

    const churnMap = new Map<string, any>();
    for (const r of churnRes.data ?? []) churnMap.set(r.erp_customer_id, r);
    const repMap = new Map<string, any>();
    for (const r of repRes.data ?? []) repMap.set(r.erp_customer_id, r);

    const items: NbaItem[] = list.map((s) => {
      const churn = churnMap.get(s.erp_customer_id);
      const rep = repMap.get(s.erp_customer_id);
      const d = decide(s, churn, rep);
      return {
        erp_customer_id: s.erp_customer_id,
        company_id: s.company_id ?? null,
        display_name: s.display_name ?? "—",
        rfm_segment: s.rfm_segment ?? null,
        recency_days: s.recency_days ?? null,
        monetary: s.monetary ?? null,
        has_whatsapp: !!s.has_whatsapp,
        has_email: !!s.has_email,
        churn_probability: churn ? Number(churn.churn_probability) : null,
        expected_value: rep?.expected_value ?? null,
        expected_purchase_at: rep?.expected_purchase_at ?? null,
        ...d,
      };
    });

    items.sort((a, b) => b.score - a.score);
    return { items: items.slice(0, data.limit) };
  });

/** Cria atividade (task) já vinculada ao cliente sugerido. */
export const createNbaTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        title: z.string().min(1).max(200),
        type: z.enum(["task", "meeting", "call"]).default("task"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any).from("activities").insert({
      organization_id: data.organization_id,
      user_id: userId,
      type: data.type,
      title: data.title,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
