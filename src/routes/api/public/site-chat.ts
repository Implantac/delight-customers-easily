import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash, randomBytes } from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-site-key, x-visitor-token",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { "Content-Type": "application/json", ...CORS },
  });

const startSchema = z.object({
  action: z.literal("start"),
  visitor_name: z.string().trim().max(150).optional(),
  visitor_email: z.string().trim().max(255).email().optional().or(z.literal("")),
  visitor_phone: z.string().trim().max(40).optional(),
  page_url: z.string().trim().max(2000).optional(),
  referrer: z.string().trim().max(2000).optional(),
});
const sendSchema = z.object({
  action: z.literal("send"),
  body: z.string().trim().min(1).max(4000),
});
const pollSchema = z.object({
  action: z.literal("poll"),
  since: z.string().datetime().optional(),
});
const bodySchema = z.discriminatedUnion("action", [startSchema, sendSchema, pollSchema]);

function originAllowed(allowed: string[], origin: string | null) {
  if (!allowed || allowed.length === 0) return true; // sem allowlist = aceita
  if (!origin) return false;
  try {
    const host = new URL(origin).host.toLowerCase();
    return allowed.some((a) => {
      const norm = a.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      return host === norm || host.endsWith("." + norm);
    });
  } catch {
    return false;
  }
}

async function loadKey(siteKey: string) {
  const { data } = await supabaseAdmin
    .from("site_chat_keys")
    .select("id, organization_id, allowed_origins, is_active")
    .eq("public_key", siteKey)
    .maybeSingle();
  return data;
}

export const Route = createFileRoute("/api/public/site-chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const siteKey = request.headers.get("x-site-key");
        if (!siteKey) return json({ error: "missing_site_key" }, 401);

        const key = await loadKey(siteKey);
        if (!key || !key.is_active) return json({ error: "invalid_site_key" }, 401);

        if (!originAllowed(key.allowed_origins ?? [], request.headers.get("origin"))) {
          return json({ error: "origin_not_allowed" }, 403);
        }

        let payload: z.infer<typeof bodySchema>;
        try {
          payload = bodySchema.parse(await request.json());
        } catch (e: any) {
          return json({ error: "invalid_body", detail: e?.message }, 400);
        }

        if (payload.action === "start") {
          const visitor_token = randomBytes(24).toString("hex");
          const ipHash = createHash("sha256")
            .update(request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "")
            .digest("hex");

          const { data: session, error } = await supabaseAdmin
            .from("site_chat_sessions")
            .insert({
              organization_id: key.organization_id,
              site_key_id: key.id,
              visitor_token,
              visitor_name: payload.visitor_name || null,
              visitor_email: payload.visitor_email || null,
              visitor_phone: payload.visitor_phone || null,
              page_url: payload.page_url || null,
              referrer: payload.referrer || null,
              user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
              ip_hash: ipHash,
            })
            .select("id")
            .single();
          if (error) return json({ error: error.message }, 500);

          await supabaseAdmin.from("site_chat_messages").insert({
            session_id: session.id,
            organization_id: key.organization_id,
            sender_kind: "system",
            body: "Conversa iniciada.",
          });

          return json({ ok: true, session_id: session.id, visitor_token });
        }

        const visitorToken = request.headers.get("x-visitor-token");
        if (!visitorToken) return json({ error: "missing_visitor_token" }, 401);

        const { data: session } = await supabaseAdmin
          .from("site_chat_sessions")
          .select("id, organization_id, site_key_id")
          .eq("visitor_token", visitorToken)
          .maybeSingle();
        if (!session || session.site_key_id !== key.id) {
          return json({ error: "invalid_visitor" }, 401);
        }

        if (payload.action === "send") {
          const now = new Date().toISOString();
          const { error } = await supabaseAdmin.from("site_chat_messages").insert({
            session_id: session.id,
            organization_id: session.organization_id,
            sender_kind: "visitor",
            body: payload.body,
          });
          if (error) return json({ error: error.message }, 500);
          await supabaseAdmin
            .from("site_chat_sessions")
            .update({ last_message_at: now, unread_for_agent: 1, status: "open" })
            .eq("id", session.id);
          return json({ ok: true });
        }

        // poll
        let q = supabaseAdmin
          .from("site_chat_messages")
          .select("id, sender_kind, body, created_at")
          .eq("session_id", session.id)
          .order("created_at", { ascending: true })
          .limit(200);
        if (payload.since) q = q.gt("created_at", payload.since);
        const { data: msgs, error } = await q;
        if (error) return json({ error: error.message }, 500);
        return json({ messages: msgs ?? [] });
      },
    },
  },
});
