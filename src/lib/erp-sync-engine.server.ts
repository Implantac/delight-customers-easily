/**
 * ERP Sync Engine — executor de jobs de `erp_sync_jobs`.
 * Server-only (importado apenas por server routes / serverFns).
 *
 * Fluxo por job:
 *   1. Resolve driver pela integration
 *   2. Pulla página atual (cursor)
 *   3. Faz upsert nas tabelas-espelho (erp_customers / erp_sales_reps / erp_sales_history)
 *   4. Detecta conflitos básicos contra valores existentes
 *   5. Se has_more → reagenda novo job com o próximo cursor
 *   6. Marca job succeeded/failed e atualiza erp_integrations.last_sync_at
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDriver, resolveDriverKey } from "./erp-drivers";
import type { ErpDriverConfig } from "./erp-drivers/types";

const PAGE_SIZE = 100;

export function adminClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

type JobRow = {
  id: string; organization_id: string; integration_id: string;
  resource: string; cursor: Record<string, unknown> | null;
  attempts: number; max_attempts: number;
};

export async function executeJob(supabase: SupabaseClient, job: JobRow): Promise<{
  ok: boolean; processed: number; failed: number; error?: string;
}> {
  const { data: integ, error: ierr } = await supabase
    .from("erp_integrations")
    .select("provider,connector_type,app_key,app_secret,settings")
    .eq("id", job.integration_id)
    .maybeSingle();
  if (ierr || !integ) return { ok: false, processed: 0, failed: 0, error: "Integração não encontrada" };

  const cfg: ErpDriverConfig = {
    app_key: integ.app_key,
    app_secret: integ.app_secret ?? null,
    settings: (integ.settings ?? {}) as Record<string, unknown>,
  };

  let driver;
  try {
    driver = getDriver(resolveDriverKey(integ.provider, integ.connector_type));
  } catch (e) {
    return { ok: false, processed: 0, failed: 0, error: (e as Error).message };
  }

  try {
    if (job.resource === "customers") {
      const r = await driver.pullCustomers(cfg, job.cursor, PAGE_SIZE);
      let conflicts = 0;
      for (const c of r.rows) {
        const { data: existing } = await supabase
          .from("erp_customers")
          .select("id,trade_name,legal_name,email,phone")
          .eq("organization_id", job.organization_id)
          .eq("integration_id", job.integration_id)
          .eq("external_id", c.external_id)
          .maybeSingle();

        if (existing) {
          // detecta divergência simples
          if (existing.email && c.email && existing.email !== c.email) {
            await supabase.from("erp_sync_conflicts").insert({
              organization_id: job.organization_id, integration_id: job.integration_id,
              resource: "customers", external_id: c.external_id, field: "email",
              crm_value: { email: existing.email }, erp_value: { email: c.email },
            });
            conflicts++;
          }
        }

        await supabase.from("erp_customers").upsert({
          organization_id: job.organization_id,
          integration_id: job.integration_id,
          external_id: c.external_id,
          legal_name: c.legal_name, trade_name: c.trade_name,
          document: c.document, email: c.email, phone: c.phone,
          address: c.address, city: c.city, state: c.state, zip: c.zip,
          segment: c.segment, is_active: c.is_active,
          last_purchase_at: c.last_purchase_at,
          credit_limit: c.credit_limit, credit_status: c.credit_status,
        }, { onConflict: "organization_id,integration_id,external_id" });
      }
      await scheduleNext(supabase, job, r.next_cursor);
      return { ok: true, processed: r.rows.length, failed: conflicts };
    }

    if (job.resource === "sales_reps") {
      const r = await driver.pullSalesReps(cfg, job.cursor, PAGE_SIZE);
      for (const v of r.rows) {
        await supabase.from("erp_sales_reps").upsert({
          organization_id: job.organization_id,
          integration_id: job.integration_id,
          external_id: v.external_id,
          name: v.name, email: v.email, phone: v.phone, region: v.region,
          is_active: v.is_active,
        }, { onConflict: "organization_id,integration_id,external_id" });
      }
      await scheduleNext(supabase, job, r.next_cursor);
      return { ok: true, processed: r.rows.length, failed: 0 };
    }

    if (job.resource === "sales_history") {
      const since = (job.cursor?.since as string) ?? null;
      const r = await driver.pullSalesHistory(cfg, job.cursor, PAGE_SIZE, since);
      for (const o of r.rows) {
        // resolve FK erp_customer_id pelo external_customer_id
        const { data: cust } = await supabase
          .from("erp_customers").select("id")
          .eq("organization_id", job.organization_id)
          .eq("integration_id", job.integration_id)
          .eq("external_id", o.external_customer_id)
          .maybeSingle();

        await supabase.from("erp_sales_history").upsert({
          organization_id: job.organization_id,
          integration_id: job.integration_id,
          external_id: o.external_id,
          erp_customer_id: cust?.id ?? null,
          order_date: o.order_date,
          total_value: o.total_value,
          items_count: o.items_count,
          status: o.status,
        }, { onConflict: "organization_id,integration_id,external_id" });
      }
      await scheduleNext(supabase, job, r.next_cursor);
      return { ok: true, processed: r.rows.length, failed: 0 };
    }

    return { ok: false, processed: 0, failed: 0, error: `Resource '${job.resource}' não suportado` };
  } catch (e) {
    return { ok: false, processed: 0, failed: 0, error: (e as Error).message };
  }
}

async function scheduleNext(supabase: SupabaseClient, job: JobRow, nextCursor: Record<string, unknown> | null) {
  if (!nextCursor) return;
  await supabase.from("erp_sync_jobs").insert({
    organization_id: job.organization_id,
    integration_id: job.integration_id,
    resource: job.resource,
    direction: "pull",
    status: "pending",
    cursor: nextCursor,
    scheduled_at: new Date(Date.now() + 2000).toISOString(),
  });
}
