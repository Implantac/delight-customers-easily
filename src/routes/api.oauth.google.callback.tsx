import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/oauth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return new Response("Google OAuth não configurado", { status: 500 });
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) return Response.redirect(`${url.origin}/integrations/apps?oauth=error&reason=${error}`, 302);
        if (!code || !state) return new Response("Parâmetros ausentes", { status: 400 });

        // valida state
        const { data: st } = await supabaseAdmin
          .from("oauth_states")
          .select("*")
          .eq("state", state)
          .maybeSingle();
        if (!st || new Date(st.expires_at).getTime() < Date.now()) {
          return new Response("State inválido ou expirado", { status: 400 });
        }
        await supabaseAdmin.from("oauth_states").delete().eq("state", state);

        // troca code por tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: st.redirect_uri,
            grant_type: "authorization_code",
          }),
        });
        if (!tokenRes.ok) {
          const t = await tokenRes.text();
          return new Response(`Falha ao trocar token: ${t.slice(0, 300)}`, { status: 502 });
        }
        const tokenJson: any = await tokenRes.json();
        const expiresAt = new Date(Date.now() + (tokenJson.expires_in ?? 3600) * 1000).toISOString();

        // descobre email da conta
        let label: string | null = null;
        try {
          const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokenJson.access_token}` },
          });
          if (ui.ok) label = (await ui.json())?.email ?? null;
        } catch { /* noop */ }

        await supabaseAdmin
          .from("integration_connections")
          .upsert({
            organization_id: st.organization_id,
            kind: st.kind,
            account_label: label,
            status: "active",
            access_token: tokenJson.access_token,
            refresh_token: tokenJson.refresh_token ?? null,
            token_expires_at: expiresAt,
            scopes: typeof tokenJson.scope === "string" ? tokenJson.scope.split(" ") : null,
            created_by: st.user_id,
            last_error: null,
          }, { onConflict: "organization_id,kind,account_label" });

        return Response.redirect(`${url.origin}/integrations/apps?oauth=success&kind=${st.kind}`, 302);
      },
    },
  },
});
