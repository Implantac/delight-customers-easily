import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getDriver, type WAChannelConfig } from "@/lib/whatsapp-drivers.server";

/**
 * Webhook universal de inbound de WhatsApp.
 * URL: /api/public/hooks/whatsapp-webhook/{channelId}
 *
 * Meta WABA: GET (verify) com hub.verify_token == channel.webhook_secret
 *            POST com X-Hub-Signature-256 (HMAC-SHA256 do raw body)
 * Evolution / UAZAPI: POST com header apikey/token validado contra webhook_secret
 * Twilio: POST application/x-www-form-urlencoded; valida X-Twilio-Signature (se webhook_secret)
 *
 * Toda requisição é gravada em whatsapp_inbound_events para auditoria/replay.
 */
function decryptCredentials(enc: string | null): Record<string, string> | null {
  if (!enc) return null;
  try { return JSON.parse(enc); } catch { return null; }
}

export const Route = createFileRoute("/api/public/hooks/whatsapp-webhook/$channelId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const { data: ch } = await supabaseAdmin
          .from("whatsapp_channels")
          .select("webhook_secret, provider")
          .eq("id", params.channelId)
          .maybeSingle();
        if (mode === "subscribe" && ch?.provider === "meta_waba" && token && ch.webhook_secret && token === ch.webhook_secret) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      },
      POST: async ({ request, params }) => {
        const rawBody = await request.text();
        const { data: ch } = await supabaseAdmin
          .from("whatsapp_channels")
          .select("id, organization_id, provider, phone_number, phone_number_id, business_account_id, base_url, instance_name, webhook_secret, credentials_encrypted, status")
          .eq("id", params.channelId)
          .maybeSingle();
        if (!ch) return new Response("channel not found", { status: 404 });

        // Validação de assinatura por provedor
        let signatureOk = true;
        const sigHeader =
          request.headers.get("x-hub-signature-256") ??
          request.headers.get("x-twilio-signature") ??
          request.headers.get("apikey") ??
          request.headers.get("token");

        if (ch.provider === "meta_waba" && ch.webhook_secret) {
          const sig = request.headers.get("x-hub-signature-256") ?? "";
          const expected = "sha256=" + createHmac("sha256", ch.webhook_secret).update(rawBody).digest("hex");
          signatureOk =
            sig.length === expected.length &&
            timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
        } else if ((ch.provider === "evolution" || ch.provider === "uazapi") && ch.webhook_secret) {
          const got = request.headers.get("apikey") ?? request.headers.get("token") ?? "";
          signatureOk = got === ch.webhook_secret;
        }

        let payload: unknown = null;
        try { payload = JSON.parse(rawBody); }
        catch {
          // Twilio: form-urlencoded
          const form = new URLSearchParams(rawBody);
          payload = Object.fromEntries(form.entries());
        }

        // Sempre registra evento bruto
        await supabaseAdmin.from("whatsapp_inbound_events").insert({
          channel_id: ch.id,
          provider: ch.provider,
          event_type: typeof payload === "object" && payload ? (payload as any).object ?? "message" : null,
          payload: payload as any,
          signature: sigHeader,
          processed: false,
        });

        if (!signatureOk) {
          return new Response(JSON.stringify({ error: "invalid signature" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        const channel: WAChannelConfig = {
          id: ch.id, organization_id: ch.organization_id, provider: ch.provider,
          phone_number: ch.phone_number, phone_number_id: ch.phone_number_id,
          business_account_id: ch.business_account_id, base_url: ch.base_url,
          instance_name: ch.instance_name, webhook_secret: ch.webhook_secret,
          credentials: decryptCredentials(ch.credentials_encrypted),
        };

        const driver = getDriver(channel.provider);
        const messages = driver.parseInbound(payload, channel);

        for (const m of messages) {
          // Encontra ou cria conversa por (org, phone)
          const { data: existing } = await supabaseAdmin
            .from("whatsapp_conversations")
            .select("id")
            .eq("organization_id", ch.organization_id)
            .eq("contact_phone", m.from_phone)
            .maybeSingle();

          let convId = existing?.id;
          if (!convId) {
            const { data: created } = await supabaseAdmin
              .from("whatsapp_conversations")
              .insert({
                organization_id: ch.organization_id,
                channel_id: ch.id,
                contact_name: m.from_phone,
                contact_phone: m.from_phone,
                status: "open",
              })
              .select("id")
              .single();
            convId = created?.id;
          }
          if (!convId) continue;

          await supabaseAdmin.from("whatsapp_messages").insert({
            conversation_id: convId,
            organization_id: ch.organization_id,
            channel_id: ch.id,
            direction: "in",
            body: m.body,
            status: "delivered",
            provider_message_id: m.provider_message_id || null,
          });
        }

        return new Response(JSON.stringify({ ok: true, ingested: messages.length }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
