import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listInput = z.object({ organization_id: z.string().uuid() });

export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => listInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("message_templates")
      .select("id, name, channel, category, subject, body, usage_count, created_by, updated_at")
      .eq("organization_id", data.organization_id)
      .order("usage_count", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

const upsertInput = z.object({
  organization_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  channel: z.enum(["email", "whatsapp", "sms", "call_script"]),
  category: z.string().max(60).nullable().optional(),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(1).max(20_000),
});

export const upsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("message_templates")
        .update({
          name: data.name, channel: data.channel, category: data.category ?? null,
          subject: data.subject ?? null, body: data.body,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("message_templates")
      .insert({
        organization_id: data.organization_id,
        name: data.name, channel: data.channel, category: data.category ?? null,
        subject: data.subject ?? null, body: data.body,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

const deleteInput = z.object({ id: z.string().uuid() });
export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => deleteInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("message_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const useInput = z.object({ id: z.string().uuid() });
export const markTemplateUsed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => useInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cur } = await supabase
      .from("message_templates").select("usage_count").eq("id", data.id).single();
    const next = ((cur as { usage_count: number } | null)?.usage_count ?? 0) + 1;
    await supabase.from("message_templates").update({ usage_count: next }).eq("id", data.id);
    return { usage_count: next };
  });
