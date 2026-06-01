/**
 * Worker do disparo de campanhas de email.
 *
 * Fluxo do tick (a cada minuto via pg_cron):
 *  1. Pega até CAMPAIGN_BATCH campanhas com status='scheduled' e scheduled_at <= now()
 *  2. Marca cada uma como 'sending'
 *  3. Para cada campanha, pega até RECIPIENT_BATCH destinatários com status='pending'
 *     e dispara via Resend. Atualiza status do destinatário (sent/bounced) e contadores.
 *  4. Quando não houver mais 'pending', marca campanha como 'sent'.
 *
 * Idempotente: pode rodar em paralelo sem dupla-enviar (UPDATE filtra por status='pending').
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmailViaResend } from "./email-send.server";

const CAMPAIGN_BATCH = 5;
const RECIPIENT_BATCH = 50;

export async function processScheduledCampaigns(supabase: SupabaseClient) {
  const now = new Date().toISOString();

  const { data: scheduled } = await supabase
    .from("email_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .limit(CAMPAIGN_BATCH);

  let started = 0;
  for (const c of scheduled ?? []) {
    const { error } = await supabase
      .from("email_campaigns")
      .update({ status: "sending" })
      .eq("id", c.id)
      .eq("status", "scheduled");
    if (!error) started++;
  }

  const { data: sending } = await supabase
    .from("email_campaigns")
    .select("id, subject, from_name, from_email, reply_to, body_html")
    .eq("status", "sending")
    .limit(CAMPAIGN_BATCH);

  let totalSent = 0;
  let totalFailed = 0;
  let totalFinalized = 0;

  for (const camp of sending ?? []) {
    const { data: recipients } = await supabase
      .from("email_campaign_recipients")
      .select("id, email, name")
      .eq("campaign_id", camp.id)
      .eq("status", "pending")
      .limit(RECIPIENT_BATCH);

    const list = recipients ?? [];
    const fromAddr = `${camp.from_name} <${camp.from_email}>`;

    for (const rec of list) {
      const result = await sendEmailViaResend({
        from: fromAddr,
        to: rec.email,
        subject: camp.subject,
        html: camp.body_html,
        reply_to: camp.reply_to,
      });
      if (result.ok) {
        totalSent++;
        await supabase
          .from("email_campaign_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
          .eq("id", rec.id)
          .eq("status", "pending");
      } else {
        totalFailed++;
        await supabase
          .from("email_campaign_recipients")
          .update({ status: "bounced", bounced_at: new Date().toISOString(), error: result.error })
          .eq("id", rec.id)
          .eq("status", "pending");
      }
    }

    // Atualiza contadores agregados desta campanha
    const { count: sentCount } = await supabase
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", camp.id)
      .eq("status", "sent");
    const { count: bouncedCount } = await supabase
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", camp.id)
      .eq("status", "bounced");
    const { count: pendingCount } = await supabase
      .from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", camp.id)
      .eq("status", "pending");

    const patch: any = {
      total_sent: sentCount ?? 0,
      total_delivered: sentCount ?? 0,
      total_bounced: bouncedCount ?? 0,
    };
    if ((pendingCount ?? 0) === 0) {
      patch.status = "sent";
      patch.sent_at = new Date().toISOString();
      totalFinalized++;
    }
    await supabase.from("email_campaigns").update(patch).eq("id", camp.id);
  }

  return { started, sent: totalSent, failed: totalFailed, finalized: totalFinalized };
}
