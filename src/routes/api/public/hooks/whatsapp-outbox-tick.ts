import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processWhatsAppOutbox } from "@/lib/whatsapp-dispatcher.server";
import { logger, withTiming } from "@/lib/logger.server";

export const Route = createFileRoute("/api/public/hooks/whatsapp-outbox-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!apikey || !expected || apikey !== expected) {
          logger.warn("hook.unauthorized", { route: "wa-outbox-tick" });
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const r = await withTiming("hook.wa-outbox-tick", { route: "wa-outbox-tick" },
            () => processWhatsAppOutbox(supabaseAdmin));
          return new Response(JSON.stringify({ ok: true, ...r }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const m = e instanceof Error ? e.message : "unknown";
          return new Response(JSON.stringify({ ok: false, error: m }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
