/**
 * Worker de progressão de sequências de cadência.
 *
 * Quando o usuário matricula um contato em uma sequência, o sistema já cria
 * todas as activities com `due_date = today + day_offset`. Para passos do
 * tipo 'email', precisamos despachar automaticamente quando a due_date chegar.
 * Para 'task', 'call', 'meeting', 'note' a activity fica para o vendedor executar.
 *
 * Idempotência: marca activity.completed=true assim que dispara.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmailViaResend } from "./email-send.server";

const BATCH = 100;

export async function processSequenceEmails(supabase: SupabaseClient) {
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);

  // Activities de email ainda não completas, com due_date passada, vinculadas a contato.
  const { data: pending } = await supabase
    .from("activities")
    .select("id, organization_id, contact_id, title, description")
    .eq("type", "email")
    .eq("completed", false)
    .not("contact_id", "is", null)
    .lte("due_date", today.toISOString())
    .limit(BATCH);

  if (!pending || pending.length === 0) {
    return { picked: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const contactIds = Array.from(new Set(pending.map((a: any) => a.contact_id)));
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, email, organization_id")
    .in("id", contactIds);
  const byContact = new Map<string, any>();
  (contacts ?? []).forEach((c: any) => byContact.set(c.id, c));

  // Só dispara contato que tem enrollment ATIVO (não disparar emails de tasks manuais).
  const { data: activeEnrolls } = await supabase
    .from("sequence_enrollments")
    .select("contact_id")
    .in("contact_id", contactIds)
    .eq("status", "active");
  const activeSet = new Set((activeEnrolls ?? []).map((e: any) => e.contact_id));

  // Resolve nome do org para usar como "from_name" — usa a primeira org dos contatos.
  const orgIds = Array.from(new Set(pending.map((a: any) => a.organization_id)));
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", orgIds);
  const orgName = new Map<string, string>();
  (orgs ?? []).forEach((o: any) => orgName.set(o.id, o.name ?? "CRM"));

  let sent = 0; let failed = 0; let skipped = 0;
  for (const act of pending) {
    const contact = byContact.get(act.contact_id);
    if (!contact?.email || !activeSet.has(contact.id)) {
      skipped++;
      continue;
    }
    const from = `${orgName.get(act.organization_id) ?? "CRM"} <onboarding@resend.dev>`;
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
      <p>Olá ${contact.name ?? ""},</p>
      <div>${(act.description ?? "").replace(/\n/g, "<br/>")}</div>
    </div>`;
    const result = await sendEmailViaResend({
      from, to: contact.email, subject: act.title, html,
    });
    if (result.ok) {
      sent++;
      await supabase.from("activities").update({
        completed: true,
        description: `[Enviado automaticamente] ${act.description ?? ""}`,
      }).eq("id", act.id).eq("completed", false);
    } else {
      failed++;
      await supabase.from("activities").update({
        description: `[Falha envio: ${result.error}] ${act.description ?? ""}`,
      }).eq("id", act.id);
    }
  }
  return { picked: pending.length, sent, failed, skipped };
}
