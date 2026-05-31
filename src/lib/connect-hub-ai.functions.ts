import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  provider: z.string().min(1).max(50),
  connection_type: z.enum(["api", "db", "agent", "csv"]),
  error_message: z.string().min(1).max(2000),
});

export const diagnoseConnectionError = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      // Sem IA: devolve mensagem genérica amigável
      return {
        summary: "Não conseguimos conectar ao seu ERP.",
        suggestions: [
          "Confira se as credenciais (chave/senha) estão corretas.",
          "Verifique sua conexão com a internet.",
          "Tente novamente em alguns minutos.",
        ],
      };
    }

    const system = `Você é um assistente de TI que ajuda usuários LEIGOS a resolver erros de conexão com ERPs no Brasil.
NUNCA use jargão técnico. NUNCA mencione códigos HTTP, stack traces, SQL ou nomes de tabela.
Sempre responda em português do Brasil, em linguagem simples, como se estivesse falando com um dono de PME.
Retorne JSON estrito:
{
  "summary": "frase única explicando o que aconteceu em linguagem leiga (máx 140 caracteres)",
  "suggestions": ["sugestão 1", "sugestão 2", "sugestão 3"]
}
Cada sugestão deve ser uma ação prática que o usuário consegue fazer sozinho.`;

    const user = `Tipo de ERP: ${data.provider}
Forma de conexão tentada: ${data.connection_type}
Erro técnico recebido: ${data.error_message}

Explique para um usuário leigo e dê 3 sugestões práticas.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      const raw = (j?.choices?.[0]?.message?.content ?? "{}").toString();
      const parsed = JSON.parse(raw);
      return {
        summary: String(parsed.summary ?? "Não conseguimos conectar ao seu ERP.").slice(0, 200),
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions.slice(0, 5).map((s: unknown) => String(s).slice(0, 200))
          : [],
      };
    } catch {
      return {
        summary: "Não conseguimos conectar ao seu ERP.",
        suggestions: [
          "Confira se as credenciais (chave/senha) estão corretas.",
          "Verifique se o ERP está online.",
          "Tente novamente em alguns minutos.",
        ],
      };
    }
  });
