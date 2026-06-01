/**
 * Outbox processor — propaga mutações do CRM para o ERP.
 *
 * Fluxo por item:
 *   1. Carrega integração + decifra credenciais (AES-256-GCM via credentials_enc)
 *   2. Resolve driver e verifica se ele implementa o método de push para o entity
 *   3. Drivers sem suporte → marca needs_manual com nota
 *   4. Despacha → resolved (status='succeeded') ou failed (com retry incremental)
 *
 * Regras absolutas:
 *   - Só entidades comerciais (customers por enquanto). NUNCA fiscal/estoque/financeiro.
 *   - Respeita `max_attempts` antes de marcar failed terminal.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDriver, resolveDriverKey } from "./erp-drivers";
import type { ErpDriverConfig } from "./erp-drivers/types";
import { decryptCredentials } from "./erp-crypto.server";

const BATCH = 25;

type OutboxRow = {
  id: string; organization_id: string; integration_id: string;
  entity: string; action: string; external_id: string | null;
  payload: Record<string, unknown>; attempts: number; max_attempts: number;
};

async function loadDriverContext(supabase: SupabaseClient, integrationId: string) {
  const { data: integ } = await (supabase as any)
    .from("erp_integrations")
    .select("provider,connector_type,app_key,app_secret,settings,credentials_enc,is_active")
    .eq("id", integrationId)
    .maybeSingle();
  if (!integ) throw new Error("Integração não encontrada");
  if (!integ.is_active) throw new Error("Integração inativa");

  let creds: Record<string, unknown> = {};
  if (integ.credentials_enc) {
    creds = decryptCredentials<Record<string, unknown>>(integ.credentials_enc);
  }
  const legacySecret = integ.app_secret && integ.app_secret !== "enc::see_credentials_enc" ? integ.app_secret : null;
  const cfg: ErpDriverConfig = {
    app_key: String(creds.app_key ?? integ.app_key ?? ""),
    app_secret: (creds.app_secret as string | undefined) ?? legacySecret,
    settings: { ...((integ.settings ?? {}) as Record<string, unknown>), ...creds },
  };
  const driver = getDriver(resolveDriverKey(integ.provider, integ.connector_type));
  return { driver, cfg };
}

export async function processOutbox(supabase: SupabaseClient): Promise<{
  picked: number; resolved: number; needs_manual: number; failed: number;
}> {
  const nowIso = new Date().toISOString();
  const { data: items } = await supabase
    .from("erp_outbox")
    .select("id,organization_id,integration_id,entity,action,external_id,payload,attempts,max_attempts")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH);

  if (!items || items.length === 0) {
    return { picked: 0, resolved: 0, needs_manual: 0, failed: 0 };
  }

  let needs_manual = 0; let failed = 0; let resolved = 0;
  for (const item of items as OutboxRow[]) {
    await supabase.from("erp_outbox")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", item.id);

    const attempts = (item.attempts ?? 0) + 1;
    try {
      const { driver, cfg } = await loadDriverContext(supabase, item.integration_id);

      // Por enquanto só customers via pushCustomer. Outras entidades caem em needs_manual.
      if (item.entity !== "customer" || !driver.pushCustomer) {
        needs_manual++;
        await supabase.from("erp_outbox").update({
          status: "needs_manual",
          attempts,
          last_error: driver.pushCustomer
            ? `Entidade '${item.entity}' não suportada para push automático.`
            : `Driver '${driver.id}' ainda não implementa push automático para clientes.`,
          finished_at: new Date().toISOString(),
          started_at: null,
        }).eq("id", item.id);
        continue;
      }

      if (item.action !== "create" && item.action !== "update") {
        needs_manual++;
        await supabase.from("erp_outbox").update({
          status: "needs_manual",
          attempts,
          last_error: `Ação '${item.action}' requer revisão manual.`,
          finished_at: new Date().toISOString(),
          started_at: null,
        }).eq("id", item.id);
        continue;
      }

      const p = item.payload ?? {};
      const result = await driver.pushCustomer(cfg, {
        external_id: item.external_id ?? (p.external_id as string | undefined) ?? null,
        legal_name: (p.legal_name as string | null) ?? null,
        trade_name: (p.trade_name as string | null) ?? null,
        document: (p.document as string | null) ?? null,
        email: (p.email as string | null) ?? null,
        phone: (p.phone as string | null) ?? null,
      });

      // Eco do external_id de volta para o espelho local quando foi criação
      if (!item.external_id && (p.crm_customer_id as string | undefined)) {
        await supabase.from("erp_customers").update({ external_id: result.external_id })
          .eq("organization_id", item.organization_id)
          .eq("integration_id", item.integration_id)
          .eq("id", p.crm_customer_id as string);
      }

      resolved++;
      await supabase.from("erp_outbox").update({
        status: "succeeded",
        attempts,
        external_id: result.external_id,
        last_error: null,
        finished_at: new Date().toISOString(),
        started_at: null,
      }).eq("id", item.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      const terminal = attempts >= (item.max_attempts ?? 5);
      if (terminal) {
        failed++;
        await supabase.from("erp_outbox").update({
          status: "failed",
          attempts,
          last_error: msg,
          finished_at: new Date().toISOString(),
          started_at: null,
        }).eq("id", item.id);
      } else {
        // back-off exponencial simples: 1m, 2m, 4m, 8m...
        const delayMin = Math.min(60, 2 ** (attempts - 1));
        const next = new Date(Date.now() + delayMin * 60_000).toISOString();
        await supabase.from("erp_outbox").update({
          status: "pending",
          attempts,
          last_error: msg,
          scheduled_at: next,
          started_at: null,
        }).eq("id", item.id);
      }
    }
  }

  return { picked: items.length, resolved, needs_manual, failed };
}
