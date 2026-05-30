import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const Schema = z.object({
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  payload: z.record(z.string(), z.any()),
  source_url: z.string().max(2000).optional(),
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const Route = createFileRoute('/api/public/lead-form')({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
        const { slug, payload, source_url } = parsed.data;

        const { data: form, error: fErr } = await supabaseAdmin
          .from('lead_forms')
          .select('id, organization_id, fields, active, create_contact, create_deal, default_source, default_owner_id, success_message, redirect_url')
          .eq('slug', slug)
          .single();
        if (fErr || !form) {
          return new Response(JSON.stringify({ error: 'Form not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
        if (!form.active) {
          return new Response(JSON.stringify({ error: 'Form inactive' }), { status: 403, headers: { 'Content-Type': 'application/json', ...CORS } });
        }

        // Validate required fields
        const fields = (form.fields as any[]) ?? [];
        for (const f of fields) {
          if (f.required && !payload[f.key]) {
            return new Response(JSON.stringify({ error: `Field "${f.label}" required` }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
          }
        }

        const email = (payload.email ?? payload.Email ?? '').toString().trim().slice(0, 320) || null;
        const name = (payload.name ?? payload.nome ?? payload.full_name ?? '').toString().trim().slice(0, 255) || null;
        const phone = (payload.phone ?? payload.telefone ?? '').toString().trim().slice(0, 50) || null;
        const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? null;
        const ua = request.headers.get('user-agent') ?? null;

        let contactId: string | null = null;
        let dealId: string | null = null;

        if (form.create_contact && (email || name)) {
          const { data: c } = await supabaseAdmin
            .from('contacts')
            .insert({
              organization_id: form.organization_id,
              full_name: name ?? email ?? 'Lead sem nome',
              email,
              phone,
              source: form.default_source ?? 'form',
              owner_id: form.default_owner_id ?? null,
            } as any)
            .select('id').single();
          contactId = c?.id ?? null;
        }

        if (form.create_deal) {
          const { data: d } = await supabaseAdmin
            .from('deals')
            .insert({
              organization_id: form.organization_id,
              title: `Lead — ${name ?? email ?? 'sem nome'}`,
              contact_id: contactId,
              owner_id: form.default_owner_id ?? null,
              source: form.default_source ?? 'form',
            } as any)
            .select('id').single();
          dealId = d?.id ?? null;
        }

        await supabaseAdmin.from('lead_form_submissions').insert({
          organization_id: form.organization_id,
          form_id: form.id,
          payload,
          email, name, phone,
          contact_id: contactId,
          deal_id: dealId,
          source_url: source_url ?? null,
          ip_address: ip,
          user_agent: ua,
        });

        await supabaseAdmin
          .from('lead_forms')
          .update({ submissions_count: ((form as any).submissions_count ?? 0) + 1 } as any)
          .eq('id', form.id);

        return new Response(JSON.stringify({
          ok: true,
          message: form.success_message ?? 'Recebido com sucesso',
          redirect_url: form.redirect_url,
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
      },
    },
  },
});
