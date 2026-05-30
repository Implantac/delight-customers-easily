import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// Endpoint público para registrar visita a uma LP de influenciador.
// Chamado pelo route /i/$org/$slug ao montar. Sem PII; rate-limit feito por
// visitor_id + IP no nível de banco (idempotência leve no client).

const Body = z.object({
  org_slug: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  visitor_id: z.string().max(80).optional(),
  referer: z.string().max(500).optional(),
  utm_source: z.string().max(80).optional(),
  utm_campaign: z.string().max(80).optional(),
  country: z.string().max(8).optional(),
});

export const Route = createFileRoute("/api/public/influencer-visit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { data: org } = await supabaseAdmin
          .from("organizations")
          .select("id")
          .eq("slug", body.org_slug)
          .maybeSingle();
        if (!org) return new Response("Not found", { status: 404 });

        const { data: inf } = await supabaseAdmin
          .from("influencers")
          .select("id,is_active")
          .eq("organization_id", org.id)
          .eq("slug", body.slug)
          .maybeSingle();

        if (!inf || !inf.is_active) {
          return new Response("Not found", { status: 404 });
        }

        const ua = request.headers.get("user-agent")?.slice(0, 300) ?? null;

        await supabaseAdmin.from("influencer_visits").insert({
          organization_id: org.id,
          influencer_id: inf.id,
          visitor_id: body.visitor_id ?? null,
          referer: body.referer ?? null,
          user_agent: ua,
          utm_source: body.utm_source ?? null,
          utm_campaign: body.utm_campaign ?? null,
          country: body.country ?? null,
        });


        return Response.json({ ok: true });
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
    },
  },
});
