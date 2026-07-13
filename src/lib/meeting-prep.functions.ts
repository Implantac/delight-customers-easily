import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Meeting Prep Brief — gera um briefing pré-reunião para um deal usando IA.
 * Consolida: dados do deal, empresa, contato, últimas atividades e mensagens WhatsApp,
 * histórico de estágios; devolve talking points, perguntas de descoberta,
 * possíveis objeções e próxima ação recomendada.
 */
const Input = z.object({
  organization_id: z.string().uuid(),
  deal_id: z.string().uuid(),
  meeting_goal: z.string().max(200).optional(),
});

export type MeetingPrep = {
  headline: string;
  context: string;
  talking_points: string[];
  discovery_questions: string[];
  likely_objections: { objection: string; response: string }[];
  next_action: string;
  risks: string[];
};

export const generateMeetingPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }): Promise<MeetingPrep> => {
    const { supabase } = context;

    const [dealRes, evRes, actRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, title, value, stage, expected_close, created_at, updated_at, company_id, contact_id, notes")
        .eq("id", data.deal_id)
        .eq("organization_id", data.organization_id)
        .maybeSingle(),
      (supabase as any)
        .from("deal_events")
        .select("event_type, from_value, to_value, created_at")
        .eq("deal_id", data.deal_id)
        .order("created_at", { ascending: false })
        .limit(20),
      (supabase as any)
        .from("activities")
        .select("type, title, description, due_date, completed_at, created_at")
        .eq("deal_id", data.deal_id)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    if (dealRes.error || !dealRes.data) throw new Error(dealRes.error?.message ?? "Deal não encontrado");
    const deal = dealRes.data as any;

    const [compRes, contRes] = await Promise.all([
      deal.company_id
        ? supabase.from("companies").select("name, industry, size, website, notes").eq("id", deal.company_id).maybeSingle()
        : Promise.resolve({ data: null }),
      deal.contact_id
        ? supabase.from("contacts").select("full_name, position, email, phone, notes").eq("id", deal.contact_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const company = (compRes as any).data;
    const contact = (contRes as any).data;

    const activitiesTxt = ((actRes.data ?? []) as any[])
      .map((a) => `- [${a.type}] ${a.title ?? ""} ${a.description ? `— ${a.description}` : ""} (${new Date(a.created_at).toLocaleDateString("pt-BR")})`)
      .join("\n") || "—";

    const eventsTxt = ((evRes.data ?? []) as any[])
      .slice(0, 10)
      .map((e) => {
        const d = new Date(e.created_at).toLocaleDateString("pt-BR");
        if (e.event_type === "stage_changed")
          return `- ${d}: mudou etapa ${(e.from_value as any)?.stage ?? "?"} → ${(e.to_value as any)?.stage ?? "?"}`;
        return `- ${d}: ${e.event_type}`;
      })
      .join("\n") || "—";

    const dealCtx = `
Negócio: ${deal.title}
Etapa: ${deal.stage}
Valor: ${Number(deal.value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
Previsão fechamento: ${deal.expected_close ?? "—"}
Notas: ${deal.notes ?? "—"}

Empresa: ${company?.name ?? "—"} | setor: ${company?.industry ?? "—"} | porte: ${company?.size ?? "—"}
Website: ${company?.website ?? "—"}
Notas empresa: ${company?.notes ?? "—"}

Contato: ${contact?.full_name ?? "—"} (${contact?.position ?? "—"})
Email/Fone: ${contact?.email ?? "—"} / ${contact?.phone ?? "—"}
Notas contato: ${contact?.notes ?? "—"}

Últimas atividades:
${activitiesTxt}

Histórico de eventos:
${eventsTxt}
`.trim();

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const systemPrompt = `Você é um coach de vendas B2B sênior. Gere um briefing pré-reunião objetivo, prático e em português brasileiro. Sempre devolva JSON válido no schema pedido — nada além.`;

    const userPrompt = `Objetivo da reunião: ${data.meeting_goal ?? "avançar o negócio no funil"}.

Contexto do negócio:
${dealCtx}

Devolva JSON EXATO:
{
  "headline": "resumo em 1 linha do estado atual",
  "context": "2-4 frases explicando onde estamos e por quê",
  "talking_points": ["...", "..."],
  "discovery_questions": ["...", "..."],
  "likely_objections": [{"objection": "...", "response": "..."}],
  "next_action": "próxima ação concreta com prazo",
  "risks": ["...", "..."]
}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 200)}`);
    }
    const json: any = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: MeetingPrep;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Resposta da IA não é JSON válido");
    }
    // saneamento leve
    parsed.talking_points = Array.isArray(parsed.talking_points) ? parsed.talking_points.slice(0, 8) : [];
    parsed.discovery_questions = Array.isArray(parsed.discovery_questions) ? parsed.discovery_questions.slice(0, 8) : [];
    parsed.likely_objections = Array.isArray(parsed.likely_objections) ? parsed.likely_objections.slice(0, 6) : [];
    parsed.risks = Array.isArray(parsed.risks) ? parsed.risks.slice(0, 6) : [];
    return parsed;
  });
