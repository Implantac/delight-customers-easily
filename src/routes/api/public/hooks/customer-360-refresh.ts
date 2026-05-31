import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { requireCronApiKey } from '@/lib/cron-auth.server';

/**
 * Diário: recalcula o snapshot Customer 360 para todas as organizações.
 * Acionado por pg_cron com header apikey.
 */
export const Route = createFileRoute('/api/public/hooks/customer-360-refresh')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronApiKey(request);
        if (unauth) return unauth;

        const { data: orgs, error } = await supabaseAdmin
          .from('organizations')
          .select('id')
          .in('org_type', ['tenant', 'company', 'branch']);
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const results: Array<{ org: string; affected: number; error?: string }> = [];
        for (const o of orgs ?? []) {
          const { data: affected, error: rpcErr } = await supabaseAdmin.rpc(
            'refresh_customer_360',
            { _org: o.id },
          );
          results.push({
            org: o.id,
            affected: (affected as number | null) ?? 0,
            error: rpcErr?.message,
          });
        }

        return new Response(
          JSON.stringify({ ok: true, total: results.length, results }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      },
    },
  },
});
