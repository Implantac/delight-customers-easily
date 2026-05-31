import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Importador CSV universal — funciona para qualquer ERP que exporte planilha.
// O cliente parseia o CSV e envia { headers, rows, mapping, entity }.
// Mapping = { csvColumn -> crmField }. Suporta contacts, companies, products.

const Entity = z.enum(["contacts", "companies", "products"]);

const ImportInput = z.object({
  organization_id: z.string().uuid(),
  entity: Entity,
  mapping: z.record(z.string(), z.string()),
  rows: z.array(z.record(z.string(), z.any())).max(5000),
  dedup_field: z.string().optional(), // e.g. "email" ou "name"
});

const TARGET_FIELDS: Record<z.infer<typeof Entity>, string[]> = {
  contacts: ["name", "email", "phone", "title", "document"],
  companies: ["name", "website", "industry", "cnpj", "phone", "email"],
  products: ["name", "sku", "price", "description"],
};

function applyMapping(
  row: Record<string, any>,
  mapping: Record<string, string>,
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [src, target] of Object.entries(mapping)) {
    if (!target) continue;
    const v = row[src];
    if (v === undefined || v === null || v === "") continue;
    out[target] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

export const previewCsvImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    entity: Entity,
    headers: z.array(z.string()),
  }).parse(i))
  .handler(async ({ data }) => {
    // Sugere mapeamento por fuzzy match de nomes
    const targets = TARGET_FIELDS[data.entity];
    const suggested: Record<string, string> = {};
    for (const h of data.headers) {
      const norm = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      const hit = targets.find((t) => {
        const tn = t.toLowerCase();
        return norm === tn || norm.includes(tn) || tn.includes(norm);
      });
      if (hit) suggested[h] = hit;
    }
    // Heurísticas extras pt-BR
    for (const h of data.headers) {
      const n = h.toLowerCase();
      if (!suggested[h]) {
        if (n.includes("nome") || n.includes("razao") || n.includes("razão")) suggested[h] = "name";
        else if (n.includes("mail")) suggested[h] = "email";
        else if (n.includes("fone") || n.includes("celular") || n.includes("tel")) suggested[h] = "phone";
        else if (n.includes("cnpj")) suggested[h] = data.entity === "companies" ? "cnpj" : "document";
        else if (n.includes("cpf")) suggested[h] = "document";
        else if (n.includes("site") || n.includes("url")) suggested[h] = "website";
        else if (n.includes("preco") || n.includes("preço") || n.includes("valor")) suggested[h] = "price";
        else if (n.includes("codigo") || n.includes("código") || n === "sku") suggested[h] = "sku";
      }
    }
    return { suggested, targets };
  });

export const runCsvImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ImportInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const mapped = data.rows.map((r) => applyMapping(r, data.mapping));
    const dedup = data.dedup_field ?? (data.entity === "contacts" ? "email" : "name");

    let inserted = 0, duplicates = 0, errors = 0;
    const errorSamples: string[] = [];

    for (const row of mapped) {
      if (!row.name && !row.email) { errors++; if (errorSamples.length < 3) errorSamples.push("linha sem nome/email"); continue; }

      // Para products/contacts/companies as colunas conhecidas vão direto;
      // o resto cai em custom_values.
      const known = TARGET_FIELDS[data.entity];
      const direct: Record<string, any> = { organization_id: data.organization_id };
      if (data.entity === "contacts" || data.entity === "companies") {
        direct.user_id = context.userId;
      }
      const custom: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        if (known.includes(k) && k !== "document" && k !== "cnpj") direct[k] = v;
        else custom[k] = v;
      }
      if (data.entity === "products" && direct.price != null) {
        const n = parseFloat(String(direct.price).replace(/\./g, "").replace(",", "."));
        if (!Number.isNaN(n)) direct.price = n;
        else delete direct.price;
      }
      if (data.entity !== "products" && Object.keys(custom).length) {
        direct.custom_values = custom;
      }

      // Dedup (companies não tem coluna email — pula)
      const canDedup = row[dedup] && !(data.entity === "companies" && dedup === "email");
      if (canDedup) {
        const { data: existing } = await (supabase as any)
          .from(data.entity)
          .select("id")
          .eq("organization_id", data.organization_id)
          .eq(dedup, row[dedup])
          .maybeSingle();
        if (existing) { duplicates++; continue; }
      }

      const { error } = await (supabase as any).from(data.entity).insert(direct);
      if (error) {
        errors++;
        if (errorSamples.length < 3) errorSamples.push(error.message);
      } else {
        inserted++;
      }
    }

    return {
      ok: true,
      total: data.rows.length,
      inserted,
      duplicates,
      errors,
      errorSamples,
    };
  });
