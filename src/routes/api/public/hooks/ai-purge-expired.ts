import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { requireCronApiKey } from '@/lib/cron-auth.server';

/** Diário: remove artefatos de IA expirados. */
export const Route = createFileRoute('/api/public/hooks/ai-purge-expired')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronApiKey(request);
        if (unauth) return unauth;

        const { data, error } = await supabaseAdmin.rpc('purge_expired_ai_artifacts');
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ ok: true, results: data ?? [] }), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  },
});
