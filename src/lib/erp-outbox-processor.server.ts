/**
 * Outbox processor — propaga mutações do CRM para o ERP.
 *
 * Os drivers atuais (Bling, Postgres-direct) ainda não expõem método push.
 * Política conservadora: marca o item como `needs_manual` para revisão humana,
 * preservando a fila com auditoria completa. Quando um driver implementar
 * `pushCustomer / pushOrder`, este executor passa a despachar de fato.
 *
 * Regra absoluta: nada de operação fiscal/estoque aqui.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const BATCH = 25;

type OutboxRow = {
  id: string; organization_id: string; integration_id: string;
  entity: string; action: string; external_id: string | null;
  payload: Record<string, unknown>; attempts: number; max_attempts: number;
};

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

    // TODO(drivers): quando driver expuser pushCustomer/pushOrder, despachar aqui.
    // Por ora, marca para revisão manual com nota explicativa.
    const attempts = (item.attempts ?? 0) + 1;
    needs_manual++;
    await supabase.from("erp_outbox").update({
      status: "needs_manual",
      attempts,
      last_error: "Driver atual ainda não suporta push automático. Revisar manualmente.",
      finished_at: new Date().toISOString(),
      started_at: null,
    }).eq("id", item.id);
  }

  return { picked: items.length, resolved, needs_manual, failed };
}
