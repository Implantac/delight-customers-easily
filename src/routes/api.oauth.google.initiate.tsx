import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { randomBytes } from "crypto";

// /api/oauth/google/initiate?org=<uuid>&kind=gmail|google_calendar&user_id=<uuid>
// Em produção use middleware autenticado; aqui validamos org/user via Supabase token no header.

const SCOPES: Record<string, string[]> = {
  gmail: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "openid",
    "email",
  ],
  google_calendar: [
    "https://www.googleapis.com/auth/calendar.events",
    "openid",
    "email",
  ],
};

export const Route = createFileRoute("/api/oauth/google/initiate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
          return new Response("GOOGLE_CLIENT_ID não configurado", { status: 500 });
        }
        const url = new URL(request.url);
        const org = url.searchParams.get("org");
        const kind = url.searchParams.get("kind");
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");

        if (!org || !kind || !SCOPES[kind]) {
          return new Response("Parâmetros inválidos", { status: 400 });
        }
        if (!token) return new Response("Não autenticado", { status: 401 });

        // valida usuário
        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData.user) return new Response("Token inválido", { status: 401 });
        const userId = userData.user.id;

        // verifica membership
        const { data: mem } = await supabaseAdmin
          .from("memberships")
          .select("role")
          .eq("organization_id", org)
          .eq("user_id", userId)
          .maybeSingle();
        if (!mem) return new Response("Sem acesso à organização", { status: 403 });

        const state = randomBytes(24).toString("hex");
        const redirectUri = `${url.origin}/api/oauth/google/callback`;

        await supabaseAdmin.from("oauth_states").insert({
          state,
          organization_id: org,
          user_id: userId,
          kind,
          redirect_uri: redirectUri,
        });

        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          access_type: "offline",
          include_granted_scopes: "true",
          prompt: "consent",
          scope: SCOPES[kind].join(" "),
          state,
        });

        return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
      },
    },
  },
});
