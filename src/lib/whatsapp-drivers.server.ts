/**
 * Driver layer multi-provider para WhatsApp.
 * Estrutura pronta — tokens/credenciais entram depois via whatsapp_channels.credentials_encrypted
 * (mesmo padrão AES-256-GCM já usado em ERP Connect).
 *
 * Cada driver expõe:
 *   - sendText(channel, to, body): dispara mensagem outbound
 *   - parseInbound(payload, channel): converte webhook do provedor em evento normalizado
 *   - verifySignature(rawBody, signature, channel): valida assinatura do webhook
 */

export type WAChannelConfig = {
  id: string;
  organization_id: string;
  provider: "meta_waba" | "evolution" | "uazapi" | "twilio";
  phone_number?: string | null;
  phone_number_id?: string | null;
  business_account_id?: string | null;
  base_url?: string | null;
  instance_name?: string | null;
  webhook_secret?: string | null;
  /** JSON decifrado: { access_token?, api_key?, account_sid?, auth_token?, ... } */
  credentials?: Record<string, string> | null;
};

export type DriverSendResult =
  | { ok: true; provider_message_id?: string }
  | { ok: false; error: string; retriable: boolean };

export type NormalizedInbound = {
  provider_message_id: string;
  from_phone: string;
  to_phone?: string;
  body: string;
  type: "text" | "image" | "audio" | "video" | "document" | "other";
  timestamp: string;
};

export interface WADriver {
  sendText(channel: WAChannelConfig, to: string, body: string): Promise<DriverSendResult>;
  parseInbound(payload: unknown, channel: WAChannelConfig): NormalizedInbound[];
  verifySignature(rawBody: string, signature: string | null, channel: WAChannelConfig): boolean;
}

/* ---------------- Meta WABA (Cloud API) ---------------- */
const MetaDriver: WADriver = {
  async sendText(channel, to, body) {
    const token = channel.credentials?.access_token;
    const phoneId = channel.phone_number_id;
    if (!token || !phoneId) return { ok: false, error: "Meta WABA: access_token/phone_number_id ausente", retriable: false };
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/\D+/g, ""),
          type: "text",
          text: { body },
        }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}`, retriable: res.status >= 500 };
      return { ok: true, provider_message_id: json?.messages?.[0]?.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "fetch failed", retriable: true };
    }
  },
  parseInbound(payload) {
    const out: NormalizedInbound[] = [];
    try {
      const entries = (payload as any)?.entry ?? [];
      for (const e of entries) {
        for (const c of e?.changes ?? []) {
          const msgs = c?.value?.messages ?? [];
          for (const m of msgs) {
            out.push({
              provider_message_id: String(m.id ?? ""),
              from_phone: String(m.from ?? ""),
              body: m.text?.body ?? m.button?.text ?? m.interactive?.title ?? "[mídia]",
              type: (m.type as any) ?? "other",
              timestamp: m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString(),
            });
          }
        }
      }
    } catch { /* ignore */ }
    return out;
  },
  verifySignature(rawBody, signature, channel) {
    // Meta envia X-Hub-Signature-256: sha256=<hex>
    const secret = channel.webhook_secret;
    if (!secret || !signature) return false;
    try {
      // Hash via Web Crypto seria assíncrono; aqui simples comparação delegada ao route handler com crypto.
      return signature.length > 0; // placeholder: route handler faz HMAC real
    } catch { return false; }
  },
};

/* ---------------- Evolution API ---------------- */
const EvolutionDriver: WADriver = {
  async sendText(channel, to, body) {
    const apiKey = channel.credentials?.api_key;
    const baseUrl = channel.base_url;
    const instance = channel.instance_name;
    if (!apiKey || !baseUrl || !instance) {
      return { ok: false, error: "Evolution: base_url/instance_name/api_key ausentes", retriable: false };
    }
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: to.replace(/\D+/g, ""), text: body }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.message ?? `HTTP ${res.status}`, retriable: res.status >= 500 };
      return { ok: true, provider_message_id: json?.key?.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "fetch failed", retriable: true };
    }
  },
  parseInbound(payload) {
    const out: NormalizedInbound[] = [];
    const data = (payload as any)?.data;
    if (data?.message) {
      out.push({
        provider_message_id: String(data.key?.id ?? ""),
        from_phone: String(data.key?.remoteJid ?? "").replace(/@.*/, ""),
        body: data.message?.conversation ?? data.message?.extendedTextMessage?.text ?? "[mídia]",
        type: "text",
        timestamp: data.messageTimestamp
          ? new Date(Number(data.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString(),
      });
    }
    return out;
  },
  verifySignature(_raw, _sig, _ch) {
    // Evolution não possui assinatura padrão; validação por apikey no header já é feita no route.
    return true;
  },
};

/* ---------------- UAZAPI ---------------- */
const UazapiDriver: WADriver = {
  async sendText(channel, to, body) {
    const token = channel.credentials?.api_key;
    const baseUrl = channel.base_url;
    if (!token || !baseUrl) return { ok: false, error: "UAZAPI: base_url/api_key ausentes", retriable: false };
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/send/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token },
        body: JSON.stringify({ number: to.replace(/\D+/g, ""), text: body }),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.error ?? `HTTP ${res.status}`, retriable: res.status >= 500 };
      return { ok: true, provider_message_id: json?.id };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "fetch failed", retriable: true };
    }
  },
  parseInbound(payload) {
    const out: NormalizedInbound[] = [];
    const m = (payload as any)?.message ?? payload;
    if (m?.from && (m?.text || m?.body)) {
      out.push({
        provider_message_id: String(m.id ?? m.messageId ?? ""),
        from_phone: String(m.from).replace(/@.*/, ""),
        body: String(m.text ?? m.body ?? ""),
        type: "text",
        timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
      });
    }
    return out;
  },
  verifySignature() { return true; },
};

/* ---------------- Twilio WhatsApp ---------------- */
const TwilioDriver: WADriver = {
  async sendText(channel, to, body) {
    const sid = channel.credentials?.account_sid;
    const token = channel.credentials?.auth_token;
    const from = channel.phone_number;
    if (!sid || !token || !from) return { ok: false, error: "Twilio: account_sid/auth_token/phone_number ausentes", retriable: false };
    try {
      const auth = btoa(`${sid}:${token}`);
      const form = new URLSearchParams({
        From: `whatsapp:${from}`,
        To: `whatsapp:+${to.replace(/\D+/g, "")}`,
        Body: body,
      });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${auth}` },
        body: form.toString(),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json?.message ?? `HTTP ${res.status}`, retriable: res.status >= 500 };
      return { ok: true, provider_message_id: json?.sid };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "fetch failed", retriable: true };
    }
  },
  parseInbound(payload) {
    // Twilio entrega form-urlencoded; o route handler converte para objeto antes de chamar aqui.
    const p = payload as any;
    if (!p?.From || !p?.Body) return [];
    return [{
      provider_message_id: String(p.MessageSid ?? ""),
      from_phone: String(p.From).replace("whatsapp:", "").replace(/\D+/g, ""),
      to_phone: p.To ? String(p.To).replace("whatsapp:", "").replace(/\D+/g, "") : undefined,
      body: String(p.Body),
      type: "text",
      timestamp: new Date().toISOString(),
    }];
  },
  verifySignature() {
    // Twilio assina via X-Twilio-Signature (HMAC-SHA1 da URL+params). Validação real no route.
    return true;
  },
};

export function getDriver(provider: WAChannelConfig["provider"]): WADriver {
  switch (provider) {
    case "meta_waba": return MetaDriver;
    case "evolution": return EvolutionDriver;
    case "uazapi": return UazapiDriver;
    case "twilio": return TwilioDriver;
  }
}
