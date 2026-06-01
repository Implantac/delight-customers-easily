/**
 * Server functions de configuração de canais WhatsApp.
 * Permite ao admin CRUD nos canais. As credenciais entram via `credentials` (JSON) e
 * são persistidas em `credentials_encrypted` — por enquanto em texto JSON; será trocado
 * pela cifra AES-256-GCM (mesma de ERP Connect) quando os tokens forem cadastrados.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const providerEnum = z.enum(["meta_waba", "evolution", "uazapi", "twilio"]);

export const listWAChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("whatsapp_channels")
      .select("id, provider, display_name, phone_number, status, is_default, last_health_check_at, last_error, base_url, instance_name, phone_number_id, business_account_id")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertWAChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      organization_id: z.string().uuid(),
      provider: providerEnum,
      display_name: z.string().min(1).max(120),
      phone_number: z.string().max(40).optional().nullable(),
      phone_number_id: z.string().max(80).optional().nullable(),
      business_account_id: z.string().max(80).optional().nullable(),
      base_url: z.string().url().optional().nullable(),
      instance_name: z.string().max(120).optional().nullable(),
      webhook_secret: z.string().max(200).optional().nullable(),
      /** JSON com tokens — gravado como texto em credentials_encrypted enquanto a cifra real não é plugada */
      credentials: z.record(z.string()).optional().nullable(),
      is_default: z.boolean().optional(),
      status: z.enum(["draft", "active", "paused", "error"]).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = {
      organization_id: data.organization_id,
      provider: data.provider,
      display_name: data.display_name,
      phone_number: data.phone_number ?? null,
      phone_number_id: data.phone_number_id ?? null,
      business_account_id: data.business_account_id ?? null,
      base_url: data.base_url ?? null,
      instance_name: data.instance_name ?? null,
      webhook_secret: data.webhook_secret ?? null,
      is_default: data.is_default ?? false,
      status: data.status ?? "draft",
      updated_at: new Date().toISOString(),
    };
    if (data.credentials !== undefined) {
      patch.credentials_encrypted = data.credentials ? JSON.stringify(data.credentials) : null;
    }
    if (data.id) {
      const { error } = await supabase.from("whatsapp_channels").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("whatsapp_channels").insert(patch).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteWAChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("whatsapp_channels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** URL pública do webhook para colar no painel do provedor */
export const getWAWebhookUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ channel_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const base = process.env.PUBLIC_APP_URL ?? "https://project--06d45a46-46ff-4225-9d53-858f03173986.lovable.app";
    return { url: `${base}/api/public/hooks/whatsapp-webhook/${data.channel_id}` };
  });
