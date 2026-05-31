import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Bling v3 — usamos um Access Token (gerado pelo usuário no painel Bling
// ou via fluxo OAuth externo) salvo em `app_key`. `app_secret` opcional
// guarda o refresh_token para futura renovação automática.

const BLING_BASE = "https://www.bling.com.br/Api/v3";

async function blingFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${BLING_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = body?.error?.description || body?.error?.message || `Bling HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

async function loadBling(supabase: any, orgId: string) {
  const { data, error } = await supabase
    .from("erp_integrations")
    .select("app_key,app_secret,is_active")
    .eq("organization_id", orgId)
    .eq("provider", "bling")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Bling não configurado");
  if (!data.is_active) throw new Error("Bling desativado");
  return data.app_key as string;
}

async function touch(supabase: any, orgId: string, err?: string) {
  await supabase.from("erp_integrations")
    .update({ last_sync_at: new Date().toISOString(), last_error: err ?? null })
    .eq("organization_id", orgId).eq("provider", "bling");
}

export const testBlingConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const token = await loadBling(context.supabase, data.organization_id);
    await blingFetch("/contatos?limite=1", token);
    return { ok: true };
  });

export const syncContactToBling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    organization_id: z.string().uuid(),
    contact_id: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const token = await loadBling(supabase, data.organization_id);

    const { data: contact, error } = await supabase
      .from("contacts")
      .select("id,name,email,phone,custom_values")
      .eq("id", data.contact_id)
      .eq("organization_id", data.organization_id)
      .single();
    if (error || !contact) throw new Error(error?.message || "Contato não encontrado");

    const cv = (contact.custom_values ?? {}) as Record<string, any>;
    const doc = String(cv.document ?? cv.cnpj ?? cv.cpf ?? "").replace(/\D/g, "");
    const payload = {
      nome: contact.name,
      tipo: doc.length === 11 ? "F" : "J",
      numeroDocumento: doc || undefined,
      email: contact.email || undefined,
      telefone: contact.phone || undefined,
    };

    try {
      const resp = await blingFetch("/contatos", token, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await touch(supabase, data.organization_id);
      return { ok: true, bling_id: resp?.data?.id ?? null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await touch(supabase, data.organization_id, msg);
      throw new Error(msg);
    }
  });

export const importContactsFromBling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    organization_id: z.string().uuid(),
    limit: z.number().int().min(1).max(100).default(50),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const token = await loadBling(supabase, data.organization_id);

    try {
      const resp = await blingFetch(`/contatos?limite=${data.limit}`, token);
      const rows: any[] = resp?.data ?? [];
      let inserted = 0, skipped = 0;
      for (const r of rows) {
        const name = r.nome ?? r.razaoSocial ?? null;
        if (!name) { skipped++; continue; }
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("organization_id", data.organization_id)
          .eq("name", name)
          .maybeSingle();
        if (existing) { skipped++; continue; }
        const { error: insErr } = await supabase.from("contacts").insert({
          organization_id: data.organization_id,
          name,
          email: r.email ?? null,
          phone: r.telefone ?? null,
          custom_values: { bling_id: r.id, document: r.numeroDocumento ?? null },
        });
        if (!insErr) inserted++;
      }
      await touch(supabase, data.organization_id);
      return { ok: true, total: rows.length, inserted, skipped };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await touch(supabase, data.organization_id, msg);
      throw new Error(msg);
    }
  });
