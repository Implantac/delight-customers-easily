import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sendInput = z.object({
  to: z.string().email().max(255),
  subject: z.string().min(1).max(255),
  html: z.string().min(1).max(50_000),
  contact_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  organization_id: z.string().uuid(),
});

export const sendCrmEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendInput.parse(input))
  .handler(async ({ data, context }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      throw new Error("Integração de e-mail (Resend) não está conectada. Conecte em Configurações > Conectores.");
    }

    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "CRM <onboarding@resend.dev>",
        to: [data.to],
        subject: data.subject,
        html: data.html,
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Falha ao enviar: ${JSON.stringify(body)}`);
    }

    // Log as activity (uses authenticated client so RLS applies)
    const { supabase, userId } = context;
    await supabase.from("activities").insert({
      organization_id: data.organization_id,
      user_id: userId,
      type: "email",
      title: `Email enviado: ${data.subject}`,
      description: `Para: ${data.to}`,
      contact_id: data.contact_id ?? null,
      deal_id: data.deal_id ?? null,
      completed: true,
    });

    return { ok: true, id: (body as any).id };
  });
