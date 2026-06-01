import { createFileRoute } from "@tanstack/react-router";
import { runDueErpSyncs } from "@/lib/erp-schedule.functions";

/**
 * Tick endpoint chamado pelo pg_cron a cada minuto.
 * Varre `erp_integrations` com `next_sync_at <= now()` e enfileira jobs.
 * Segurança: valida `apikey` header com a publishable key do projeto.
 */
export const Route = createFileRoute("/api/public/hooks/erp-sync-tick")({
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
          const result = await runDueErpSyncs();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "unknown";
          console.error("[erp-sync-tick] error", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
