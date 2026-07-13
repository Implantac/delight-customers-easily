import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Resumo automático de conversa WhatsApp.
 * Pega as últimas N mensagens, envia ao Lovable AI e devolve
 * { resumo, sentimento, próxima ação sugerida }. Não persiste —
 * é sob demanda, custo controlado.
 */
const Input = z.object({
  conversation_id: z.string().uuid(),
  max_messages: z.number().int().min(5).max(80).default(40),
});

const SYSTEM = `Você é um analista comercial sênior. Recebe uma transcrição de conversa WhatsApp entre um vendedor e um cliente/lead.
Responda EXCLUSIVAMENTE em JSON válido com este schema:
{
  "summary": "3-5 bullets curtos em português, começando com '- '. Foco no que foi combinado, dúvidas, objeções.",
  "sentiment": "positivo" | "neutro" | "negativo",
  "temperature": "quente" | "morno" | "frio",
  "next_action": "1 frase imperativa com CTA claro (canal + mensagem-chave + prazo)",
  "risks": ["até 3 riscos ou pendências não resolvidos"]
}`;

export const summarizeWhatsAppConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: conv, error: convErr } = await supabase
      .from("whatsapp_conversations")
      .select("id, organization_id, contact_name, contact_phone")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (convErr) throw new Error(convErr.message);
    if (!conv) throw new Error("Conversa não encontrada");

    const { data: msgs, error: msgErr } = await supabase
      .from("whatsapp_messages")
      .select("direction, body, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: false })
      .limit(data.max_messages);
    if (msgErr) throw new Error(msgErr.message);

    const ordered = (msgs ?? []).slice().reverse();
    if (ordered.length === 0) throw new Error("Nenhuma mensagem para resumir");

    const transcript = ordered
      .map((m: any) => {
        const who = m.direction === "in" ? (conv.contact_name || "Cliente") : "Vendedor";
        const when = new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
        return `[${when}] ${who}: ${(m.body ?? "").toString().replace(/\s+/g, " ").slice(0, 500)}`;
      })
      .join("\n");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Cliente: ${conv.customer_name ?? conv.customer_phone ?? "—"}\n\nTranscrição (mais antiga → mais recente):\n${transcript}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 429) throw new Error("Limite de uso de IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA insuficientes.");
    if (!res.ok) throw new Error(`IA falhou: ${res.status}`);
    const j = await res.json();
    const raw = (j?.choices?.[0]?.message?.content ?? "").toString();
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { summary: raw, sentiment: "neutro", temperature: "morno", next_action: "", risks: [] };
    }
    return {
      summary: String(parsed.summary ?? ""),
      sentiment: (parsed.sentiment ?? "neutro") as "positivo" | "neutro" | "negativo",
      temperature: (parsed.temperature ?? "morno") as "quente" | "morno" | "frio",
      next_action: String(parsed.next_action ?? ""),
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String).slice(0, 3) : [],
      messages_used: ordered.length,
    };
  });
