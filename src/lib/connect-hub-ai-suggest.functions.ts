import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAi(system: string, user: string): Promise<unknown> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI indisponível");
  const res = await fetch(GATEWAY, {
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
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const j = await res.json();
  const raw = (j?.choices?.[0]?.message?.content ?? "{}").toString();
  return JSON.parse(raw);
}

// =====================================================================
// 1) Sugestão de ERP a partir de uma descrição livre do usuário
// =====================================================================

const SuggestProviderInput = z.object({
  description: z.string().min(3).max(500),
});

const KNOWN_PROVIDERS = [
  { id: "omie", name: "Omie", method: "api" },
  { id: "bling", name: "Bling", method: "api" },
  { id: "tiny", name: "Tiny ERP", method: "csv" },
  { id: "conta-azul", name: "Conta Azul", method: "csv" },
  { id: "sankhya", name: "Sankhya", method: "db" },
  { id: "totvs-protheus", name: "TOTVS Protheus", method: "db" },
  { id: "totvs-rm", name: "TOTVS RM", method: "db" },
  { id: "senior", name: "Senior", method: "db" },
  { id: "custom", name: "ERP personalizado / planilha", method: "csv" },
];

export const suggestErpProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SuggestProviderInput.parse(i))
  .handler(async ({ data }) => {
    const fallback = {
      provider_id: "custom",
      provider_name: "ERP personalizado",
      connection_method: "csv" as const,
      confidence: 0.3,
      reasoning: "Sem IA disponível — recomendamos importar por planilha.",
    };
    try {
      const system = `Você é um especialista em ERPs brasileiros para PMEs.
Dado um texto descrevendo o ERP do usuário, identifique qual provedor da lista melhor se encaixa
e qual o método de conexão recomendado.

Provedores disponíveis (use exatamente o id):
${KNOWN_PROVIDERS.map((p) => `- ${p.id} (${p.name}, método: ${p.method})`).join("\n")}

Métodos: "api" (chave/token), "db" (banco direto), "csv" (planilha), "agent" (agente local).
Se não tiver certeza ou for um ERP corporativo desconhecido, use "custom" com "csv".

Responda APENAS JSON estrito:
{
  "provider_id": "<id da lista>",
  "provider_name": "<nome amigável>",
  "connection_method": "api" | "db" | "csv" | "agent",
  "confidence": 0.0-1.0,
  "reasoning": "frase curta em português explicando para um leigo (máx 140 chars)"
}`;
      const user = `Descrição do usuário: "${data.description}"`;
      const parsed = (await callAi(system, user)) as Record<string, unknown>;
      const id = String(parsed.provider_id ?? "custom");
      const known = KNOWN_PROVIDERS.find((p) => p.id === id) ?? KNOWN_PROVIDERS[KNOWN_PROVIDERS.length - 1];
      const method = ["api", "db", "csv", "agent"].includes(String(parsed.connection_method))
        ? (parsed.connection_method as "api" | "db" | "csv" | "agent")
        : (known.method as "api" | "db" | "csv" | "agent");
      const conf = Number(parsed.confidence ?? 0.5);
      return {
        provider_id: known.id,
        provider_name: String(parsed.provider_name ?? known.name).slice(0, 80),
        connection_method: method,
        confidence: Math.min(1, Math.max(0, conf)),
        reasoning: String(parsed.reasoning ?? "").slice(0, 200),
      };
    } catch {
      return fallback;
    }
  });

// =====================================================================
// 2) Auto-mapeamento de colunas com amostras (mais inteligente que regex)
// =====================================================================

const SuggestMappingInput = z.object({
  entity: z.enum(["contacts", "companies", "products"]),
  headers: z.array(z.string().min(1).max(120)).min(1).max(60),
  sample_rows: z.array(z.array(z.string().max(200))).max(5).optional(),
});

const TARGET_FIELDS: Record<string, { field: string; label: string }[]> = {
  contacts: [
    { field: "name", label: "Nome completo" },
    { field: "email", label: "E-mail" },
    { field: "phone", label: "Telefone / celular" },
    { field: "title", label: "Cargo" },
    { field: "document", label: "CPF/CNPJ" },
  ],
  companies: [
    { field: "name", label: "Razão social / nome" },
    { field: "website", label: "Site" },
    { field: "industry", label: "Segmento" },
    { field: "cnpj", label: "CNPJ" },
    { field: "phone", label: "Telefone" },
    { field: "email", label: "E-mail" },
  ],
  products: [
    { field: "name", label: "Nome do produto" },
    { field: "sku", label: "Código / SKU" },
    { field: "price", label: "Preço" },
    { field: "description", label: "Descrição" },
  ],
};

export const suggestFieldMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SuggestMappingInput.parse(i))
  .handler(async ({ data }) => {
    const targets = TARGET_FIELDS[data.entity];
    const targetIds = targets.map((t) => t.field);

    const fallback = () => {
      const mapping: Record<string, { field: string; confidence: number; reason: string }> = {};
      for (const h of data.headers) {
        const n = h.toLowerCase().replace(/[^a-z0-9]/g, "");
        const hit = targetIds.find((t) => n === t || n.includes(t) || t.includes(n));
        if (hit) mapping[h] = { field: hit, confidence: 0.6, reason: "Nome parecido" };
      }
      return { mapping, targets };
    };

    try {
      const sample = (data.sample_rows ?? []).slice(0, 3);
      const system = `Você mapeia colunas de planilhas de ERPs brasileiros para campos do CRM.
Para cada coluna recebida, escolha o melhor campo de destino OU "skip" se não fizer sentido.
Use os valores de amostra para desambiguar (ex: distinguir CPF de CNPJ pelo número de dígitos).

Campos disponíveis (use exatamente o id):
${targets.map((t) => `- ${t.field}: ${t.label}`).join("\n")}
- skip: ignorar esta coluna

Responda APENAS JSON estrito:
{
  "mapping": {
    "<nome exato da coluna>": {
      "field": "<id do campo ou 'skip'>",
      "confidence": 0.0-1.0,
      "reason": "explicação curta em português (máx 80 chars)"
    }
  }
}
Inclua TODAS as colunas recebidas no objeto mapping.`;

      const user = `Entidade: ${data.entity}
Colunas: ${JSON.stringify(data.headers)}
${sample.length ? `Amostras (primeiras linhas): ${JSON.stringify(sample)}` : ""}`;

      const parsed = (await callAi(system, user)) as { mapping?: Record<string, unknown> };
      const rawMap = parsed.mapping ?? {};
      const mapping: Record<string, { field: string; confidence: number; reason: string }> = {};
      for (const h of data.headers) {
        const entry = rawMap[h] as Record<string, unknown> | undefined;
        if (!entry) continue;
        const field = String(entry.field ?? "skip");
        if (field !== "skip" && !targetIds.includes(field)) continue;
        if (field === "skip") continue;
        mapping[h] = {
          field,
          confidence: Math.min(1, Math.max(0, Number(entry.confidence ?? 0.5))),
          reason: String(entry.reason ?? "").slice(0, 120),
        };
      }
      // Garante que colunas óbvias não fiquem de fora se a IA pular
      if (Object.keys(mapping).length === 0) return fallback();
      return { mapping, targets };
    } catch {
      return fallback();
    }
  });
