// Lovable AI Gateway helper (server-only).
// Reads LOVABLE_API_KEY at call time from process.env.

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type GatewayResponse = {
  content: string;
  model: string;
  tokensIn?: number;
  tokensOut?: number;
};

const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function callLovableAI(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; jsonMode?: boolean } = {},
): Promise<GatewayResponse> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const model = opts.model ?? "google/gemini-2.5-flash";
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.4,
  };
  if (opts.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    throw new Error("Limite de requisições de IA excedido. Tente novamente em instantes.");
  }
  if (res.status === 402) {
    throw new Error("Créditos de IA insuficientes. Adicione créditos no workspace.");
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AI Gateway erro ${res.status}: ${txt.slice(0, 200)}`);
  }

  const json: any = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  return {
    content,
    model,
    tokensIn: json?.usage?.prompt_tokens,
    tokensOut: json?.usage?.completion_tokens,
  };
}

export function safeJSON<T = unknown>(text: string): T | null {
  try {
    const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}
