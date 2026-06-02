import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const upsertInput = z.object({
  organization_id: z.string().uuid(),
  channel: z.enum(["app", "whatsapp", "both"]),
  send_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  timezone: z.string().min(1).max(64),
  whatsapp_phone: z.string().min(5).max(32).nullable().optional(),
  enabled: z.boolean(),
});

export const getMyBriefingPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("briefing_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { prefs: data };
  });

export const upsertBriefingPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      organization_id: data.organization_id,
      channel: data.channel,
      send_time: data.send_time.length === 5 ? `${data.send_time}:00` : data.send_time,
      timezone: data.timezone,
      whatsapp_phone: data.whatsapp_phone ?? null,
      enabled: data.enabled,
    };
    const { error } = await supabase
      .from("briefing_preferences")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
