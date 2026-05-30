import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================================
// Tipos
// ============================================================================

export type ErpIntegration = {
  id: string;
  organization_id: string;
  provider: "omie";
  app_key: string;
  app_secret: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

const INTEG_COLS = "id,organization_id,provider,app_key,app_secret,is_active,last_sync_at,last_error,created_at,updated_at";

// ============================================================================
// Helpers — Omie API (JSON-RPC like)
// ============================================================================

const OMIE_BASE = "https://app.omie.com.br/api/v1";

async function omieCall(
  endpoint: string,
  call: string,
  appKey: string,
  appSecret: string,
  param: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${OMIE_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      call,
      app_key: appKey,
      app_secret: appSecret,
      param: [param],
    }),
  });
  const text = await res.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok || body?.faultstring) {
    throw new Error(body?.faultstring || `Omie HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return body;
}

function buildClientePayload(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  codigo_cliente_integracao: string;
}): Record<string, unknown> {
  // Omie /geral/clientes IncluirCliente / AlterarCliente payload
  const doc = (input.document || "").replace(/\D/g, "");
  return {
    codigo_cliente_integracao: input.codigo_cliente_integracao,
    razao_social: input.name,
    nome_fantasia: input.name,
    cnpj_cpf: doc || undefined,
    email: input.email || undefined,
    telefone1_numero: input.phone || undefined,
    pessoa_fisica: doc.length === 11 ? "S" : "N",
  };
}

// ============================================================================
// Configuração
// ============================================================================

export const getErpIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; provider?: "omie" }) => d)
  .handler(async ({ data, context }) => {
    const provider = data.provider ?? "omie";
    const { data: row, error } = await context.supabase
      .from("erp_integrations")
      .select("*")
      .eq("organization_id", data.organization_id)
      .eq("provider", provider)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { integration: (row as ErpIntegration) ?? null };
  });

export const saveErpIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    provider?: "omie";
    app_key: string;
    app_secret: string;
    is_active?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const provider = data.provider ?? "omie";
    if (!data.app_key.trim() || !data.app_secret.trim()) {
      throw new Error("app_key e app_secret são obrigatórios");
    }
    const { data: row, error } = await (context.supabase as any)
      .from("erp_integrations")
      .upsert(
        {
          organization_id: data.organization_id,
          provider,
          app_key: data.app_key.trim(),
          app_secret: data.app_secret.trim(),
          is_active: data.is_active ?? true,
          last_error: null,
        },
        { onConflict: "organization_id,provider" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { integration: row as ErpIntegration };
  });

export const deleteErpIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; provider?: "omie" }) => d)
  .handler(async ({ data, context }) => {
    const provider = data.provider ?? "omie";
    const { error } = await context.supabase
      .from("erp_integrations")
      .delete()
      .eq("organization_id", data.organization_id)
      .eq("provider", provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const testErpConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: integ, error } = await context.supabase
      .from("erp_integrations")
      .select("*")
      .eq("organization_id", data.organization_id)
      .eq("provider", "omie")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!integ) throw new Error("Integração Omie não configurada");
    // ListarClientes com pagina=1 e registros_por_pagina=1 = teste leve
    await omieCall(
      "/geral/clientes/",
      "ListarClientes",
      integ.app_key,
      integ.app_secret,
      { pagina: 1, registros_por_pagina: 1, apenas_importado_api: "N" },
    );
    return { ok: true };
  });

// ============================================================================
// Sincronização — Contatos & Empresas → Omie
// ============================================================================

async function loadIntegration(supabase: any, orgId: string) {
  const { data: integ, error } = await supabase
    .from("erp_integrations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("provider", "omie")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!integ) throw new Error("Configure as credenciais do Omie antes de sincronizar");
  if (!integ.is_active) throw new Error("Integração Omie está desativada");
  return integ as ErpIntegration;
}

async function touchIntegration(supabase: any, orgId: string, error?: string) {
  await supabase
    .from("erp_integrations")
    .update({ last_sync_at: new Date().toISOString(), last_error: error ?? null })
    .eq("organization_id", orgId)
    .eq("provider", "omie");
}

export const syncContactToOmie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; contact_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const integ = await loadIntegration(supabase, data.organization_id);

    const { data: contact, error: cErr } = await supabase
      .from("contacts")
      .select("id, name, email, phone, omie_id, custom_values")
      .eq("id", data.contact_id)
      .eq("organization_id", data.organization_id)
      .single();
    if (cErr || !contact) throw new Error(cErr?.message || "Contato não encontrado");

    const cv = (contact.custom_values ?? {}) as Record<string, unknown>;
    const payload = buildClientePayload({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      document: (cv.document as string) ?? null,
      codigo_cliente_integracao: `crm-contact-${contact.id}`,
    });

    try {
      const call = contact.omie_id ? "AlterarCliente" : "IncluirCliente";
      const body = contact.omie_id
        ? { ...payload, codigo_cliente_omie: contact.omie_id }
        : payload;
      const resp = (await omieCall(
        "/geral/clientes/",
        call,
        integ.app_key,
        integ.app_secret,
        body,
      )) as { codigo_cliente_omie?: number };

      const omieId = resp.codigo_cliente_omie ?? contact.omie_id;
      await supabase
        .from("contacts")
        .update({ omie_id: omieId, omie_synced_at: new Date().toISOString() })
        .eq("id", contact.id);
      await touchIntegration(supabase, data.organization_id);
      return { ok: true, omie_id: omieId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await touchIntegration(supabase, data.organization_id, msg);
      throw new Error(msg);
    }
  });

export const syncCompanyToOmie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; company_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const integ = await loadIntegration(supabase, data.organization_id);

    const { data: company, error: cErr } = await supabase
      .from("companies")
      .select("id, name, website, omie_id, custom_values")
      .eq("id", data.company_id)
      .eq("organization_id", data.organization_id)
      .single();
    if (cErr || !company) throw new Error(cErr?.message || "Empresa não encontrada");

    const cv = (company.custom_values ?? {}) as Record<string, unknown>;
    const payload = buildClientePayload({
      name: company.name,
      email: (cv.email as string) ?? null,
      phone: (cv.phone as string) ?? null,
      document: (cv.cnpj as string) ?? (cv.document as string) ?? null,
      codigo_cliente_integracao: `crm-company-${company.id}`,
    });

    try {
      const call = company.omie_id ? "AlterarCliente" : "IncluirCliente";
      const body = company.omie_id
        ? { ...payload, codigo_cliente_omie: company.omie_id }
        : payload;
      const resp = (await omieCall(
        "/geral/clientes/",
        call,
        integ.app_key,
        integ.app_secret,
        body,
      )) as { codigo_cliente_omie?: number };

      const omieId = resp.codigo_cliente_omie ?? company.omie_id;
      await supabase
        .from("companies")
        .update({ omie_id: omieId, omie_synced_at: new Date().toISOString() })
        .eq("id", company.id);
      await touchIntegration(supabase, data.organization_id);
      return { ok: true, omie_id: omieId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await touchIntegration(supabase, data.organization_id, msg);
      throw new Error(msg);
    }
  });

// ============================================================================
// Lista resumida para a UI de Integrações
// ============================================================================

export const listIntegrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ count: contactsSynced }, { count: contactsTotal }, { count: companiesSynced }, { count: companiesTotal }] =
      await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", data.organization_id).not("omie_id", "is", null),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", data.organization_id),
        supabase.from("companies").select("id", { count: "exact", head: true }).eq("organization_id", data.organization_id).not("omie_id", "is", null),
        supabase.from("companies").select("id", { count: "exact", head: true }).eq("organization_id", data.organization_id),
      ]);
    return {
      contacts: { synced: contactsSynced ?? 0, total: contactsTotal ?? 0 },
      companies: { synced: companiesSynced ?? 0, total: companiesTotal ?? 0 },
    };
  });
