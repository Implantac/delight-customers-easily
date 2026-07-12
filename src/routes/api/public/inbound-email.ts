import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const PayloadSchema = z.object({
  from: z.string().trim().email().max(320),
  to: z.string().trim().max(320).optional(),
  subject: z.string().trim().max(500).optional().default('(sem assunto)'),
  text: z.string().max(50000).optional(),
  html: z.string().max(200000).optional(),
});

function timingSafeEqualStr(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute('/api/public/inbound-email')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INBOUND_EMAIL_SECRET;
        if (!secret) {
          return new Response('Server not configured', { status: 500 });
        }

        const provided = request.headers.get('x-webhook-secret') ?? '';
        if (!provided || !timingSafeEqualStr(provided, secret)) {
          return new Response('Unauthorized', { status: 401 });
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }

        const parsed = PayloadSchema.safeParse(raw);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: 'Invalid payload', details: parsed.error.flatten() }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const { from, subject, text, html } = parsed.data;
        const fromEmail = from.toLowerCase();

        // Find contact by email (across all orgs — uses admin client, bypasses RLS).
        const { data: contact, error: contactErr } = await supabaseAdmin
          .from('contacts')
          .select('id, organization_id, user_id')
          .ilike('email', fromEmail)
          .limit(1)
          .maybeSingle();

        if (contactErr) {
          console.error('inbound-email contact lookup failed', contactErr);
          return new Response('Lookup failed', { status: 500 });
        }

        if (!contact) {
          // No matching contact — acknowledge without creating activity.
          return Response.json({ ok: true, matched: false });
        }

        const description = (text ?? html ?? '').slice(0, 10000);

        const { error: insertErr } = await supabaseAdmin.from('activities').insert({
          organization_id: contact.organization_id,
          user_id: contact.user_id,
          contact_id: contact.id,
          type: 'email',
          title: `Email recebido: ${subject}`,
          description,
          completed: true,
        });

        if (insertErr) {
          console.error('inbound-email insert failed', insertErr);
          return new Response('Insert failed', { status: 500 });
        }

        // Pausa cadências ativas do contato — mesma lógica do WhatsApp reply.
        await supabaseAdmin
          .from('sequence_enrollments')
          .update({
            status: 'paused',
            paused_reason: 'Resposta recebida por e-mail',
            paused_at: new Date().toISOString(),
          })
          .eq('contact_id', contact.id)
          .eq('organization_id', contact.organization_id)
          .eq('status', 'active');

        return Response.json({ ok: true, matched: true, contact_id: contact.id });

      },
    },
  },
});
