import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Webhook universal de entrada — qualquer ERP pode postar aqui.
// Auth: bearer token (mesmo schema do erp-agent-push). Body JSON:
// { provider, entity, external_id?, data }
// data passa pelo mapeamento de campos (erp_field_mappings) configurado
// para aquela org/provider/entity antes do upsert.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const Schema = z.object({
  provider: z.string().min(1).max(50),
  entity: z.enum(["contacts", "companies", "products"]),
  external_id: z.string().max(200).optional(),
  data: z.record(z.string(), z.any()),
});

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function transform(value: any, fn: string | null): any {
  if (value == null) return value;
  const s = String(value);
  switch (fn) {
    case "trim": return s.trim();
    case "uppercase": return s.toUpperCase();
    case "lowercase": return s.toLowerCase();
    case "digits_only": return s.replace(/\D/g, "");
    case "cnpj_mask": {
      const d = s.replace(/\D/g, "").padStart(14, "0");
      return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`;
    }
    default: return s;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/hooks/erp-inbound")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.replace(/^Bearer\s+/i, "").trim();
          if (!token) return json({ error: "missing token" }, 401);

          const { data: tok, error: tokErr } = await supabaseAdmin
            .from("erp_agent_tokens")
            .select("id, organization_id, revoked_at")
            .eq("token_hash", sha256(token))
            .maybeSingle();
          if (tokErr || !tok || tok.revoked_at) return json({ error: "invalid token" }, 401);

          const parsed = Schema.parse(await request.json());

          // Carrega mapeamentos
          const { data: maps } = await supabaseAdmin
            .from("erp_field_mappings")
            .select("source_field,target_field,transform")
            .eq("organization_id", tok.organization_id)
            .eq("provider", parsed.provider)
            .eq("entity", parsed.entity);

          const mapped: Record<string, any> = { organization_id: tok.organization_id };
          const custom: Record<string, any> = {};

          if (maps && maps.length > 0) {
            for (const m of maps) {
              const v = parsed.data[m.source_field];
              if (v === undefined) continue;
              mapped[m.target_field] = transform(v, m.transform);
            }
            // Fields no payload sem mapping vão para custom_values
            for (const [k, v] of Object.entries(parsed.data)) {
              if (!maps.find((m) => m.source_field === k)) custom[k] = v;
            }
          } else {
            // Sem mapping: tenta inferir name/email diretamente
            if (parsed.data.name) mapped.name = parsed.data.name;
            if (parsed.data.email) mapped.email = parsed.data.email;
            if (parsed.data.phone) mapped.phone = parsed.data.phone;
            for (const [k, v] of Object.entries(parsed.data)) {
              if (!["name","email","phone"].includes(k)) custom[k] = v;
            }
          }
          if (parsed.entity !== "products" && Object.keys(custom).length) {
            mapped.custom_values = custom;
          }
          if (parsed.external_id) {
            mapped.custom_values = { ...(mapped.custom_values ?? {}), external_id: parsed.external_id };
          }

          if (!mapped.name && !mapped.email && parsed.entity !== "products") {
            await supabaseAdmin.from("erp_inbound_log").insert({
              organization_id: tok.organization_id,
              provider: parsed.provider, entity: parsed.entity,
              external_id: parsed.external_id ?? null, payload: parsed.data,
              status: "rejected", error: "sem name/email após mapeamento",
            });
            return json({ error: "no name/email after mapping" }, 400);
          }

          // Upsert por external_id (via custom_values->>external_id) ou email
          let existingId: string | null = null;
          if (parsed.external_id) {
            const { data: ex } = await supabaseAdmin
              .from(parsed.entity)
              .select("id")
              .eq("organization_id", tok.organization_id)
              .filter("custom_values->>external_id", "eq", parsed.external_id)
              .maybeSingle();
            existingId = ex?.id ?? null;
          }
          if (!existingId && mapped.email) {
            const { data: ex } = await supabaseAdmin
              .from(parsed.entity)
              .select("id")
              .eq("organization_id", tok.organization_id)
              .eq("email", mapped.email)
              .maybeSingle();
            existingId = ex?.id ?? null;
          }

          let action = "inserted";
          if (existingId) {
            const { error: upErr } = await supabaseAdmin
              .from(parsed.entity).update(mapped).eq("id", existingId);
            if (upErr) throw upErr;
            action = "updated";
          } else {
            const { error: insErr } = await supabaseAdmin
              .from(parsed.entity).insert(mapped);
            if (insErr) throw insErr;
          }

          await supabaseAdmin.from("erp_inbound_log").insert({
            organization_id: tok.organization_id,
            provider: parsed.provider, entity: parsed.entity,
            external_id: parsed.external_id ?? null, payload: parsed.data,
            status: action,
          });
          await supabaseAdmin.from("erp_agent_tokens")
            .update({ last_used_at: new Date().toISOString() }).eq("id", tok.id);

          return json({ success: true, action });
        } catch (e: any) {
          console.error("erp-inbound failed:", e);
          return json({ success: false, error: e?.message ?? "unknown" }, 500);
        }
      },
    },
  },
});
