import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================================
// IA de Rotas: pega uma lista de candidatos (suggestRoute heurístico) e usa
// Lovable AI para reordenar pela melhor sequência de visitas do dia,
// agrupando por proximidade (cidade) e priorizando contas de maior potencial.
// ============================================================================

const Input = z.object({
  organization_id: z.string().uuid(),
  candidates: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      industry: z.string().nullable(),
      open_value: z.number(),
      won_value: z.number(),
      daysSilent: z.number(),
    })
  ).min(1).max(30),
  start_city: z.string().optional(),
});

export const optimizeRouteWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = [
      "Você é um planejador comercial de campo. Dada a lista de clientes/prospects",
      "abaixo, retorne uma sequência ótima de visitas para HOJE.",
      start_city(data.start_city),
      "Critérios (em ordem de importância):",
      "1) Agrupar por cidade para reduzir deslocamento.",
      "2) Priorizar maior pipeline aberto (open_value) e maior tempo sem contato.",
      "3) Maximizar receita potencial do dia.",
      "",
      "Devolva JSON com este formato exato:",
      '{ "stops": [{ "id": "...", "reason": "..." }], "summary": "..." }',
      "",
      "Clientes:",
      JSON.stringify(data.candidates, null, 2),
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You return strict JSON only, no markdown fences." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI Gateway error ${res.status}`);
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    let parsed: { stops?: Array<{ id: string; reason: string }>; summary?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { stops: [], summary: "Falha ao interpretar resposta da IA." };
    }
    const byId = new Map(data.candidates.map((c) => [c.id, c]));
    const ordered = (parsed.stops ?? [])
      .map((s) => ({ ...byId.get(s.id), reason: s.reason }))
      .filter((c): c is NonNullable<typeof c> => !!c?.id);
    return { stops: ordered, summary: parsed.summary ?? "" };
  });

function start_city(city?: string) {
  return city ? `O dia começa em ${city}.` : "Não há cidade de partida definida.";
}
