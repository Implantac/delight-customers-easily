/**
 * Heartbeat do Agente Local.
 * Binário envia periodicamente (ex: a cada 60s) para atualizar last_seen_at,
 * version e os. Caso o token esteja inválido/revogado, retorna 401/403.
 *
 * POST /api/public/hooks/erp-local-agent-heartbeat
 * Headers: Authorization: Bearer <agent_token>
 * Body (opcional): { version?, os? }
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash } from "node:crypto";
import { z } from "zod";

const Body = z
  .object({
    version: z.string().max(40).optional(),
    os: z.string().max(80).optional(),
  })
  .optional();

export const Route = createFileRoute(
  "/api/public/hooks/erp-local-agent-heartbeat",
)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const m = auth.match(/^Bearer\s+(.+)$/i);
          if (!m) return new Response("Missing bearer token", { status: 401 });

          const tokenHash = createHash("sha256").update(m[1]).digest("hex");

          const { data: agent, error } = await supabaseAdmin
            .from("erp_local_agents")
            .select("id, status, organization_id")
            .eq("agent_token_hash", tokenHash)
            .maybeSingle();

          if (error || !agent) {
            return new Response("Invalid token", { status: 401 });
          }
          if (agent.status === "revoked") {
            return new Response("Agent revoked", { status: 403 });
          }

          const raw = await request.json().catch(() => ({}));
          const parsed = Body.safeParse(raw);
          const body = parsed.success ? parsed.data ?? {} : {};

          await supabaseAdmin
            .from("erp_local_agents")
            .update({
              last_seen_at: new Date().toISOString(),
              status: "online",
              ...(body.version ? { version: body.version } : {}),
              ...(body.os ? { os: body.os } : {}),
            })
            .eq("id", agent.id);

          return Response.json({
            ok: true,
            agent_id: agent.id,
            organization_id: agent.organization_id,
          });
        } catch (e) {
          console.error("erp-local-agent-heartbeat error:", e);
          return new Response("Internal error", { status: 500 });
        }
      },
    },
  },
});
