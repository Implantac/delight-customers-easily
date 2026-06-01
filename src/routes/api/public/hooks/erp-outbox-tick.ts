import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processOutbox } from "@/lib/erp-outbox-processor.server";

/**
 * Tick endpoint chamado pelo pg_cron para processar o outbox (CRM → ERP).
 * Segurança: valida `apikey` header com a publishable/anon key do projeto.
 * Idempotente: cada execução pega no máximo BATCH itens em status=pending.
 */
export const Route = createFileRoute("/api/public/hooks/erp-outbox-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.SUPABASE_ANON_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response(
            JSON.stringify({ error: "unauthorized" }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }
        try {
          const result = await processOutbox(supabaseAdmin);
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "unknown";
          console.error("[erp-outbox-tick] error", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
