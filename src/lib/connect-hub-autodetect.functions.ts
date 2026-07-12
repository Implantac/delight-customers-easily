import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * ConnectHub — Auto-detecção de campos do ERP conectado.
 *
 * Puxa uma amostra pequena (até 5 registros) do driver do ERP já configurado,
 * extrai as chaves brutas do payload (`extra`) + campos normalizados do DTO,
 * e submete à IA para sugerir o de-para com os campos do CRM.
 *
 * O usuário não precisa colar JSON: um clique detecta e propõe o mapeamento.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

// ---------- listar integrações ativas para o dropdown ----------

export const listActiveErpIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("erp_integrations")
      .select("id,provider,connector_type,is_active,last_sync_at")
      .eq("organization_id", data.organization_id)
      .eq("is_active", true)
      .order("last_sync_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return {
      integrations: (rows ?? []).map((r: any) => ({
        id: String(r.id),
        provider: String(r.provider ?? ""),
        connector_type: (r.connector_type ?? null) as string | null,
        last_sync_at: (r.last_sync_at ?? null) as string | null,
      })),
    };
  });

// ---------- auto-detect + AI mapping ----------

const AutoDetectInput = z.object({
  organization_id: z.string().uuid(),
  integration_id: z.string().uuid(),
  entity: z.enum(["contacts", "companies", "products"]),
});

export const autoDetectFromIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AutoDetectInput.parse(i))
  .handler(async ({ data, context }) => {
    const targets = TARGET_FIELDS[data.entity];
    const targetIds = targets.map((t) => t.field);

    // 1) Puxa integration + credenciais
    const { data: integ, error: ierr } = await (context.supabase as any)
      .from("erp_integrations")
      .select("id,provider,connector_type,app_key,app_secret,settings,credentials_enc")
      .eq("id", data.integration_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (ierr) throw new Error(ierr.message);
    if (!integ) throw new Error("Integração não encontrada");

    // 2) Server-only: driver + decrypt
    const { getDriver, resolveDriverKey } = await import("./erp-drivers");
    const { decryptCredentials } = await import("./erp-crypto.server");

    let creds: Record<string, unknown> = {};
    if (integ.credentials_enc) {
      try {
        creds = decryptCredentials<Record<string, unknown>>(integ.credentials_enc);
      } catch (e) {
        throw new Error(`Falha ao decifrar credenciais: ${(e as Error).message}`);
      }
    }
    const legacySecret =
      integ.app_secret && integ.app_secret !== "enc::see_credentials_enc" ? integ.app_secret : null;
    const cfg = {
      app_key: String(creds.app_key ?? integ.app_key ?? ""),
      app_secret: (creds.app_secret as string | undefined) ?? legacySecret,
      settings: { ...((integ.settings ?? {}) as Record<string, unknown>), ...creds },
    };

    let driver;
    try {
      driver = getDriver(resolveDriverKey(integ.provider, integ.connector_type));
    } catch (e) {
      throw new Error(`Driver indisponível: ${(e as Error).message}`);
    }

    // 3) Amostra por entidade (products ainda não é DTO padronizado → fallback vazio)
    const SAMPLE = 5;
    let rows: Array<Record<string, unknown>> = [];
    try {
      if (data.entity === "companies") {
        const r = await driver.pullCustomers(cfg, null, SAMPLE);
        rows = r.rows.map((c: any) => ({ ...c, ...(c.extra ?? {}) }));
      } else if (data.entity === "contacts") {
        const r = await driver.pullCustomers(cfg, null, SAMPLE);
        // contatos vêm associados a clientes; usamos o mesmo payload — a IA
        // filtra os campos que fazem sentido para contato (nome/email/fone/doc).
        rows = r.rows.map((c: any) => ({ ...c, ...(c.extra ?? {}) }));
      } else {
        // products: nenhum driver expõe DTO ainda → devolve vazio p/ UI orientar
        rows = [];
      }
    } catch (e) {
      throw new Error(`Falha ao puxar amostra do ERP: ${(e as Error).message}`);
    }

    if (rows.length === 0) {
      return {
        headers: [] as string[],
        sample_rows: [] as string[][],
        mapping: {} as Record<string, { field: string; confidence: number; reason: string }>,
        targets,
        source: { provider: integ.provider as string, sampled: 0 },
      };
    }

    // 4) Union de headers, priorizando os originais do `extra` (nomes do ERP)
    const headerSet = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) if (k !== "extra") headerSet.add(k);
    const headers = Array.from(headerSet).slice(0, 40);

    const sample_rows = rows.slice(0, 3).map((row) =>
      headers.map((h) => {
        const v = (row as any)[h];
        if (v == null) return "";
        if (typeof v === "object") return JSON.stringify(v).slice(0, 120);
        return String(v).slice(0, 120);
      }),
    );

    // 5) IA
    const fallback = () => {
      const mapping: Record<string, { field: string; confidence: number; reason: string }> = {};
      for (const h of headers) {
        const n = h.toLowerCase().replace(/[^a-z0-9]/g, "");
        const hit = targetIds.find((t) => n === t || n.includes(t) || t.includes(n));
        if (hit) mapping[h] = { field: hit, confidence: 0.6, reason: "Nome parecido" };
      }
      return mapping;
    };

    let mapping: Record<string, { field: string; confidence: number; reason: string }> = {};
    try {
      const system = `Você mapeia colunas brutas do ERP brasileiro "${integ.provider}" para campos do CRM.
Para cada coluna, escolha o melhor campo de destino OU "skip" se não fizer sentido.
Use os valores de amostra para desambiguar (ex: distinguir CPF de CNPJ, email de nome).

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
Colunas: ${JSON.stringify(headers)}
Amostras: ${JSON.stringify(sample_rows)}`;

      const parsed = (await callAi(system, user)) as { mapping?: Record<string, unknown> };
      const rawMap = parsed.mapping ?? {};
      for (const h of headers) {
        const entry = rawMap[h] as Record<string, unknown> | undefined;
        if (!entry) continue;
        const field = String(entry.field ?? "skip");
        if (field === "skip" || !targetIds.includes(field)) continue;
        mapping[h] = {
          field,
          confidence: Math.min(1, Math.max(0, Number(entry.confidence ?? 0.5))),
          reason: String(entry.reason ?? "").slice(0, 120),
        };
      }
      if (Object.keys(mapping).length === 0) mapping = fallback();
    } catch {
      mapping = fallback();
    }

    return {
      headers,
      sample_rows,
      mapping,
      targets,
      source: { provider: integ.provider as string, sampled: rows.length },
    };
  });
