import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Push endpoint for the desktop ERP Connect Agent (Tauri/Electron binary).
// The agent reads data from the customer's on-premise ERP (Windows/Linux) and
// posts batches here. Auth = bearer token whose SHA-256 hash matches a row in
// public.erp_agent_tokens. Tokens are issued by org owners/admins from the UI.

const Schema = z.object({
  entity: z.enum(["invoices", "sales_orders", "products", "contacts"]),
  rows: z.array(z.record(z.string(), z.any())).max(1000),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export const Route = createFileRoute("/api/public/hooks/erp-agent-push")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.replace(/^Bearer\s+/i, "").trim();
          if (!token) {
            return new Response(JSON.stringify({ error: "missing token" }),
              { status: 401, headers: { "Content-Type": "application/json", ...CORS } });
          }
          const hash = sha256(token);
          const { data: row, error: tokErr } = await supabaseAdmin
            .from("erp_agent_tokens")
            .select("id, organization_id, revoked_at")
            .eq("token_hash", hash)
            .maybeSingle();
          if (tokErr || !row || row.revoked_at) {
            return new Response(JSON.stringify({ error: "invalid token" }),
              { status: 401, headers: { "Content-Type": "application/json", ...CORS } });
          }

          const body = await request.json();
          const parsed = Schema.parse(body);

          // Best-effort: stamp organization_id and insert.
          const enriched = parsed.rows.map((r) => ({ ...r, organization_id: row.organization_id }));
          const { error: insErr } = await supabaseAdmin
            .from(parsed.entity as any)
            .insert(enriched as any);
          if (insErr) {
            return new Response(JSON.stringify({ error: insErr.message }),
              { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
          }

          await supabaseAdmin
            .from("erp_agent_tokens")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", row.id);

          return new Response(JSON.stringify({ success: true, inserted: enriched.length }),
            { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
        } catch (e: any) {
          console.error("erp-agent-push failed:", e);
          return new Response(JSON.stringify({ success: false, error: e?.message ?? "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
        }
      },
    },
  },
});
