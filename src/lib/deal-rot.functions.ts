import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Deal Rot Radar — detecta negócios parados no funil por tempo em estágio.
 * Usa deal_events (stage_changed) para dias-no-estágio; fallback: created_at.
 * Aplica SLA por estágio e devolve fila priorizada com ação recomendada.
 */
const Input = z.object({
  organization_id: z.string().uuid(),
  limit: z.number().int().min(1).max(200).default(50),
});

// SLA em dias por estágio (thresholds de deal rot)
const STAGE_SLA: Record<string, number> = {
  lead: 7,
  qualified: 10,
  proposal: 14,
  negotiation: 10,
};

const STAGE_LABEL: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualificado",
  proposal: "Proposta",
  negotiation: "Negociação",
};

export type RotSignal = {
  deal_id: string;
  title: string;
  stage: string;
  stage_label: string;
  value: number;
  owner_id: string | null;
  owner_name: string | null;
  company_id: string | null;
  days_in_stage: number;
  sla_days: number;
  overdue_days: number;
  severity: "high" | "medium" | "low";
  action: string;
  reason: string;
};

export const getDealRotSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }): Promise<{ items: RotSignal[]; total_value_at_risk: number }> => {
    const { supabase } = context;

    const { data: deals, error } = await supabase
      .from("deals")
      .select("id, title, stage, value, user_id, company_id, created_at, updated_at")
      .eq("organization_id", data.organization_id)
      .not("stage", "in", "(won,lost)")
      .limit(1000);
    if (error) throw new Error(error.message);
    const rows = (deals ?? []) as any[];
    if (!rows.length) return { items: [], total_value_at_risk: 0 };

    // Última mudança de estágio por deal
    const ids = rows.map((d) => d.id);
    const eventsRes = await (supabase as any)
      .from("deal_events")
      .select("deal_id, created_at, event_type")
      .in("deal_id", ids)
      .eq("event_type", "stage_changed")
      .order("created_at", { ascending: false });
    const lastStageChange = new Map<string, string>();
    for (const ev of (eventsRes.data ?? []) as any[]) {
      if (!lastStageChange.has(ev.deal_id)) lastStageChange.set(ev.deal_id, ev.created_at);
    }

    // Nomes dos owners
    const ownerIds = Array.from(new Set(rows.map((d) => d.user_id).filter(Boolean)));
    const profRes = ownerIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ownerIds)
      : { data: [] as any[] };
    const nameById = new Map<string, string>();
    for (const p of (profRes.data ?? []) as any[]) nameById.set(p.id, p.full_name ?? "—");

    const now = Date.now();
    const items: RotSignal[] = [];
    let atRisk = 0;

    for (const d of rows) {
      const sla = STAGE_SLA[d.stage] ?? 14;
      const anchor = lastStageChange.get(d.id) ?? d.created_at;
      const days = Math.floor((now - new Date(anchor).getTime()) / 86400000);
      const overdue = days - sla;
      if (overdue < 0) continue; // ainda dentro do SLA

      const ratio = overdue / Math.max(sla, 1);
      const severity: RotSignal["severity"] = ratio >= 1 ? "high" : ratio >= 0.5 ? "medium" : "low";

      let action = "Retomar contato agora";
      if (d.stage === "lead") action = "Qualificar ou descartar";
      else if (d.stage === "qualified") action = "Agendar reunião de descoberta";
      else if (d.stage === "proposal") action = "Follow-up da proposta / negociar objeções";
      else if (d.stage === "negotiation") action = "Fechar ou definir próximo passo com data";

      items.push({
        deal_id: d.id,
        title: d.title,
        stage: d.stage,
        stage_label: STAGE_LABEL[d.stage] ?? d.stage,
        value: Number(d.value ?? 0),
        owner_id: d.user_id,
        owner_name: nameById.get(d.user_id) ?? null,
        company_id: d.company_id,
        days_in_stage: days,
        sla_days: sla,
        overdue_days: overdue,
        severity,
        action,
        reason: `${days}d no estágio ${STAGE_LABEL[d.stage] ?? d.stage} (SLA ${sla}d)`,
      });
      atRisk += Number(d.value ?? 0);
    }

    items.sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 } as const;
      if (sev[b.severity] !== sev[a.severity]) return sev[b.severity] - sev[a.severity];
      return b.value - a.value;
    });

    return { items: items.slice(0, data.limit), total_value_at_risk: atRisk };
  });

/** Marca "toque" registrando uma atividade e mexendo em updated_at para reiniciar contador visual. */
export const nudgeDealRot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      organization_id: z.string().uuid(),
      deal_id: z.string().uuid(),
      note: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any).from("activities").insert({
      organization_id: data.organization_id,
      user_id: userId,
      deal_id: data.deal_id,
      type: "task",
      title: "Retomar negócio parado",
      description: data.note ?? "Deal Rot Radar sinalizou negócio em risco.",
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
