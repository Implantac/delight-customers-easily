/**
 * Pareamento do Agente Local.
 * O binário desktop envia o pairing_code (gerado em /integrations/agent)
 * e recebe um token de longa duração. Após o pareamento, o pairing_code
 * fica inutilizado (status passa de "pending" para "online").
 *
 * POST /api/public/hooks/erp-local-agent-pair
 * Body: { pairing_code: string, os?: string, version?: string }
 * Resp: 200 { agent_id, organization_id, agent_token }
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

const Body = z.object({
  pairing_code: z.string().min(8).max(64),
  os: z.string().max(80).optional(),
  version: z.string().max(40).optional(),
});

export const Route = createFileRoute("/api/public/hooks/erp-local-agent-pair")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const raw = await request.json().catch(() => null);
          const parsed = Body.safeParse(raw);
          if (!parsed.success) {
            return new Response("Invalid body", { status: 400 });
          }

          const { pairing_code, os, version } = parsed.data;

          const { data: agent, error } = await supabaseAdmin
            .from("erp_local_agents")
            .select("id, organization_id, status")
            .eq("pairing_code", pairing_code)
            .maybeSingle();

          if (error || !agent) {
            return new Response("Invalid pairing code", { status: 401 });
          }
          if (agent.status === "revoked") {
            return new Response("Pairing code revoked", { status: 403 });
          }
          if (agent.status === "online") {
            return new Response("Already paired", { status: 409 });
          }

          // Gera token longo-duração (48 bytes base64url)
          const token = randomBytes(48).toString("base64url");
          const tokenHash = createHash("sha256").update(token).digest("hex");

          const { error: upErr } = await supabaseAdmin
            .from("erp_local_agents")
            .update({
              agent_token_hash: tokenHash,
              status: "online",
              last_seen_at: new Date().toISOString(),
              os: os ?? null,
              version: version ?? null,
            })
            .eq("id", agent.id);

          if (upErr) return new Response("Pairing failed", { status: 500 });

          return Response.json({
            agent_id: agent.id,
            organization_id: agent.organization_id,
            agent_token: token,
          });
        } catch (e) {
          console.error("erp-local-agent-pair error:", e);
          return new Response("Internal error", { status: 500 });
        }
      },
    },
  },
});
