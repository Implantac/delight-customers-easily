import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; status?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("email_campaigns")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const totals = {
      draft: 0, scheduled: 0, sending: 0, sent: 0,
      recipients: 0, opened: 0, clicked: 0,
    };
    for (const r of rows ?? []) {
      if (r.status === "draft") totals.draft++;
      else if (r.status === "scheduled") totals.scheduled++;
      else if (r.status === "sending") totals.sending++;
      else if (r.status === "sent") totals.sent++;
      totals.recipients += r.total_recipients ?? 0;
      totals.opened += r.total_opened ?? 0;
      totals.clicked += r.total_clicked ?? 0;
    }
    return { campaigns: rows ?? [], totals };
  });

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    name: string;
    subject: string;
    preheader?: string | null;
    from_name: string;
    from_email: string;
    reply_to?: string | null;
    body_html: string;
    segment_id?: string | null;
    scheduled_at?: string | null;
    tags?: string[];
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      organization_id: data.organization_id,
      name: data.name,
      subject: data.subject,
      preheader: data.preheader ?? null,
      from_name: data.from_name,
      from_email: data.from_email,
      reply_to: data.reply_to ?? null,
      body_html: data.body_html,
      segment_id: data.segment_id ?? null,
      scheduled_at: data.scheduled_at || null,
      tags: data.tags ?? [],
    };
    if (data.id) {
      const { error } = await supabase.from("email_campaigns").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("email_campaigns")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const scheduleCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; scheduled_at: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("email_campaigns")
      .update({ status: "scheduled", scheduled_at: data.scheduled_at })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const populateRecipients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; campaign_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Pull all org contacts with email; skip those already added.
    const { data: contacts, error: cErr } = await supabase
      .from("contacts")
      .select("id, name, email")
      .eq("organization_id", data.organization_id)
      .not("email", "is", null)
      .limit(2000);
    if (cErr) throw new Error(cErr.message);

    const { data: existing } = await supabase
      .from("email_campaign_recipients")
      .select("contact_id")
      .eq("campaign_id", data.campaign_id);
    const have = new Set((existing ?? []).map((e: any) => e.contact_id));

    const fresh = (contacts ?? []).filter((c: any) => c.email && !have.has(c.id));
    if (fresh.length) {
      const { error } = await supabase.from("email_campaign_recipients").insert(
        fresh.map((c: any) => ({
          organization_id: data.organization_id,
          campaign_id: data.campaign_id,
          contact_id: c.id,
          email: c.email,
          name: c.name,
        }))
      );
      if (error) throw new Error(error.message);
    }
    const total = (existing?.length ?? 0) + fresh.length;
    await supabase.from("email_campaigns").update({ total_recipients: total }).eq("id", data.campaign_id);
    return { added: fresh.length, total };
  });

/**
 * Dispara o envio IMEDIATO de uma campanha (botão "Enviar agora").
 * Marca a campanha como 'scheduled' com scheduled_at=now() e delega ao
 * worker (`processScheduledCampaigns`) o disparo real via Resend. O
 * cron `campaign-tick` (a cada minuto) processará. Para envio na hora
 * mesmo, o usuário pode chamar `triggerCampaignTick` em seguida.
 */
export const sendCampaignNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await context.supabase
      .from("email_campaigns")
      .update({ status: "scheduled", scheduled_at: now })
      .eq("id", data.id)
      .in("status", ["draft", "scheduled"]);
    if (error) throw new Error(error.message);
    return { ok: true, queued_at: now };
  });

/**
 * Aciona manualmente o worker (mesmo código usado pelo cron). Útil para
 * "Enviar agora" disparar de imediato em vez de esperar o tick.
 * Usa o supabase autenticado do request — só processa o que o usuário
 * tem permissão de enxergar via RLS.
 */
export const triggerCampaignTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { processScheduledCampaigns } = await import("./campaigns-worker.server");
    return processScheduledCampaigns(context.supabase);
  });

export const recordEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { recipient_id: string; event: "opened" | "clicked" | "bounced" | "unsubscribed" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date().toISOString();
    const patch: any = { status: data.event };
    if (data.event === "opened") patch.opened_at = now;
    if (data.event === "clicked") { patch.clicked_at = now; patch.opened_at = now; }
    if (data.event === "bounced") patch.bounced_at = now;
    if (data.event === "unsubscribed") patch.unsubscribed_at = now;
    const { data: rec, error } = await supabase
      .from("email_campaign_recipients")
      .update(patch)
      .eq("id", data.recipient_id)
      .select("campaign_id")
      .single();
    if (error) throw new Error(error.message);

    // Recompute counters
    const { data: all } = await supabase
      .from("email_campaign_recipients")
      .select("status")
      .eq("campaign_id", rec.campaign_id);
    const list = all ?? [];
    await supabase
      .from("email_campaigns")
      .update({
        total_opened: list.filter((r: any) => ["opened", "clicked"].includes(r.status)).length,
        total_clicked: list.filter((r: any) => r.status === "clicked").length,
        total_bounced: list.filter((r: any) => r.status === "bounced").length,
        total_unsubscribed: list.filter((r: any) => r.status === "unsubscribed").length,
      })
      .eq("id", rec.campaign_id);
    return { ok: true };
  });

export const getCampaignDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: campaign, error } = await supabase
      .from("email_campaigns").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: recipients } = await supabase
      .from("email_campaign_recipients")
      .select("*").eq("campaign_id", data.id).order("created_at", { ascending: false }).limit(500);
    return { campaign, recipients: recipients ?? [] };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("email_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
