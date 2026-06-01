/**
 * Helper server-only para enviar email transacional via Resend (gateway Lovable).
 * Usado pelos workers de campanha e de sequência. NUNCA importar do bundle client.
 */
const GATEWAY = "https://connector-gateway.lovable.dev/resend/emails";

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export async function sendEmailViaResend(input: {
  from: string;
  to: string;
  subject: string;
  html: string;
  reply_to?: string | null;
}): Promise<SendResult> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    return { ok: false, error: "RESEND não conectado (LOVABLE_API_KEY/RESEND_API_KEY ausentes)." };
  }
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.reply_to ? { reply_to: input.reply_to } : {}),
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body?.message || `Resend HTTP ${res.status}` };
    }
    return { ok: true, id: body?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha desconhecida" };
  }
}
