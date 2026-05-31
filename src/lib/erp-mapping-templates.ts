/**
 * Templates de mapeamento prontos para ERPs comuns.
 * Aplicados via `applyMappingTemplate` — popula `erp_field_mappings`.
 * Apenas dados COMERCIAIS (contacts/companies/orders). Nada fiscal/estoque.
 */
export type MappingTemplate = {
  provider: "omie" | "tiny" | "custom";
  entity: "contacts" | "companies" | "orders";
  source_field: string;
  target_field: string;
  transform: "none" | "trim" | "uppercase" | "lowercase" | "digits_only" | "cnpj_mask";
};

export type TemplateKey = "omie" | "tiny" | "protheus";

export const MAPPING_TEMPLATES: Record<TemplateKey, MappingTemplate[]> = {
  // Omie — REST API
  omie: [
    { provider: "omie", entity: "companies", source_field: "razao_social",       target_field: "legal_name",  transform: "trim" },
    { provider: "omie", entity: "companies", source_field: "nome_fantasia",      target_field: "trade_name",  transform: "trim" },
    { provider: "omie", entity: "companies", source_field: "cnpj_cpf",           target_field: "document",    transform: "digits_only" },
    { provider: "omie", entity: "companies", source_field: "email",              target_field: "email",       transform: "lowercase" },
    { provider: "omie", entity: "companies", source_field: "telefone1_numero",   target_field: "phone",       transform: "digits_only" },
    { provider: "omie", entity: "companies", source_field: "endereco",           target_field: "address",     transform: "trim" },
    { provider: "omie", entity: "companies", source_field: "cidade",             target_field: "city",        transform: "trim" },
    { provider: "omie", entity: "companies", source_field: "estado",             target_field: "state",       transform: "uppercase" },
    { provider: "omie", entity: "companies", source_field: "cep",                target_field: "zip",         transform: "digits_only" },
    { provider: "omie", entity: "contacts",  source_field: "nome_contato",       target_field: "name",        transform: "trim" },
    { provider: "omie", entity: "contacts",  source_field: "email_contato",      target_field: "email",       transform: "lowercase" },
    { provider: "omie", entity: "orders",    source_field: "codigo_pedido",      target_field: "external_id", transform: "trim" },
    { provider: "omie", entity: "orders",    source_field: "data_previsao",      target_field: "order_date",  transform: "none" },
    { provider: "omie", entity: "orders",    source_field: "valor_total_pedido", target_field: "total_value", transform: "none" },
  ],

  // Tiny ERP — REST API
  tiny: [
    { provider: "tiny", entity: "companies", source_field: "nome",         target_field: "legal_name",  transform: "trim" },
    { provider: "tiny", entity: "companies", source_field: "fantasia",     target_field: "trade_name",  transform: "trim" },
    { provider: "tiny", entity: "companies", source_field: "cpf_cnpj",     target_field: "document",    transform: "digits_only" },
    { provider: "tiny", entity: "companies", source_field: "email",        target_field: "email",       transform: "lowercase" },
    { provider: "tiny", entity: "companies", source_field: "fone",         target_field: "phone",       transform: "digits_only" },
    { provider: "tiny", entity: "companies", source_field: "endereco",     target_field: "address",     transform: "trim" },
    { provider: "tiny", entity: "companies", source_field: "cidade",       target_field: "city",        transform: "trim" },
    { provider: "tiny", entity: "companies", source_field: "uf",           target_field: "state",       transform: "uppercase" },
    { provider: "tiny", entity: "companies", source_field: "cep",          target_field: "zip",         transform: "digits_only" },
    { provider: "tiny", entity: "contacts",  source_field: "contato_nome", target_field: "name",        transform: "trim" },
    { provider: "tiny", entity: "contacts",  source_field: "contato_email",target_field: "email",       transform: "lowercase" },
    { provider: "tiny", entity: "orders",    source_field: "numero",       target_field: "external_id", transform: "trim" },
    { provider: "tiny", entity: "orders",    source_field: "data_pedido",  target_field: "order_date",  transform: "none" },
    { provider: "tiny", entity: "orders",    source_field: "total_pedido", target_field: "total_value", transform: "none" },
  ],

  // TOTVS Protheus — geralmente integração via Postgres direct sobre SX/SA1/SC5
  // (assume views materializadas/staging para evitar tabelas SX nativas).
  protheus: [
    { provider: "custom", entity: "companies", source_field: "A1_NREDUZ", target_field: "trade_name",  transform: "trim" },
    { provider: "custom", entity: "companies", source_field: "A1_NOME",   target_field: "legal_name",  transform: "trim" },
    { provider: "custom", entity: "companies", source_field: "A1_CGC",    target_field: "document",    transform: "digits_only" },
    { provider: "custom", entity: "companies", source_field: "A1_EMAIL",  target_field: "email",       transform: "lowercase" },
    { provider: "custom", entity: "companies", source_field: "A1_TEL",    target_field: "phone",       transform: "digits_only" },
    { provider: "custom", entity: "companies", source_field: "A1_END",    target_field: "address",     transform: "trim" },
    { provider: "custom", entity: "companies", source_field: "A1_MUN",    target_field: "city",        transform: "trim" },
    { provider: "custom", entity: "companies", source_field: "A1_EST",    target_field: "state",       transform: "uppercase" },
    { provider: "custom", entity: "companies", source_field: "A1_CEP",    target_field: "zip",         transform: "digits_only" },
    { provider: "custom", entity: "contacts",  source_field: "A1_CONTATO",target_field: "name",        transform: "trim" },
    { provider: "custom", entity: "orders",    source_field: "C5_NUM",    target_field: "external_id", transform: "trim" },
    { provider: "custom", entity: "orders",    source_field: "C5_EMISSAO",target_field: "order_date",  transform: "none" },
    { provider: "custom", entity: "orders",    source_field: "C5_VALOR",  target_field: "total_value", transform: "none" },
  ],
};

export function listTemplateKeys(): TemplateKey[] {
  return Object.keys(MAPPING_TEMPLATES) as TemplateKey[];
}
