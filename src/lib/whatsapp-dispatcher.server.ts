/**
 * Worker do outbox de WhatsApp.
 * - Lê N mensagens com status='pending' e next_attempt_at <= now()
 * - Carrega o canal e decifra credenciais (placeholder: parse de credentials_encrypted como JSON)
 * - Dispara via driver. Em falha retriable, faz backoff exponencial e re-agenda.
 *
 * Quando os tokens forem cadastrados pelo usuário, basta plugar a função de decifrar
 * (mesma usada em ERP Connect: AES-256-GCM com ERP_CREDENTIALS_KEY) no `decryptCredentials`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDriver, type WAChannelConfig } from "./whatsapp-drivers.server";

const BATCH = 25;
const MAX_ATTEMPTS = 6;

function decryptCredentials(enc: string | null | undefined): Record<string, string> | null {
  if (!enc) return null;
  // TODO: integrar com helper AES-256-GCM já existente (mesmo de ERP Connect)
  // Placeholder: aceita JSON em texto puro APENAS para desenvolvimento local sem tokens.
  try { return JSON.parse(enc); } catch { return null; }
}

function backoffMinutes(attempts: number): number {
  return Math.min(60, Math.pow(2, attempts)); // 2,4,8,16,32,60
}

export async function processWhatsAppOutbox(supabase: SupabaseClient) {
  const now = new Date().toISOString();
  const { data: items } = await supabase
    .from("whatsapp_outbox")
    .select("id, channel_id, to_phone, body, attempts, conversation_id, organization_id, message_id")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .limit(BATCH);

  let sent = 0, failed = 0;
  for (const it of items ?? []) {
    // claim row
    const { data: claim } = await supabase
      .from("whatsapp_outbox")
      .update({ status: "sending" })
      .eq("id", it.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claim) continue;

    const { data: ch } = await supabase
      .from("whatsapp_channels")
      .select("id, organization_id, provider, phone_number, phone_number_id, business_account_id, base_url, instance_name, webhook_secret, credentials_encrypted, status")
      .eq("id", it.channel_id)
      .maybeSingle();

    if (!ch || ch.status !== "active") {
      await supabase.from("whatsapp_outbox").update({
        status: "failed", last_error: "canal inativo ou inexistente",
      }).eq("id", it.id);
      failed++;
      continue;
    }

    const channel: WAChannelConfig = {
      id: ch.id, organization_id: ch.organization_id, provider: ch.provider,
      phone_number: ch.phone_number, phone_number_id: ch.phone_number_id,
      business_account_id: ch.business_account_id, base_url: ch.base_url,
      instance_name: ch.instance_name, webhook_secret: ch.webhook_secret,
      credentials: decryptCredentials(ch.credentials_encrypted),
    };

    const driver = getDriver(channel.provider);
    const result = await driver.sendText(channel, it.to_phone, it.body);
    const attempts = (it.attempts ?? 0) + 1;

    if (result.ok) {
      await supabase.from("whatsapp_outbox").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts,
        provider_message_id: result.provider_message_id ?? null,
        last_error: null,
      }).eq("id", it.id);
      if (it.message_id) {
        await supabase.from("whatsapp_messages").update({
          status: "sent", provider_message_id: result.provider_message_id ?? null,
        }).eq("id", it.message_id);
      }
      sent++;
    } else {
      const giveUp = !result.retriable || attempts >= MAX_ATTEMPTS;
      const nextAt = new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString();
      await supabase.from("whatsapp_outbox").update({
        status: giveUp ? "failed" : "pending",
        attempts,
        last_error: result.error,
        next_attempt_at: giveUp ? new Date().toISOString() : nextAt,
      }).eq("id", it.id);
      if (giveUp && it.message_id) {
        await supabase.from("whatsapp_messages").update({ status: "failed" }).eq("id", it.message_id);
      }
      failed++;
    }
  }
  return { sent, failed, picked: items?.length ?? 0 };
}
