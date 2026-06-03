import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });

export type NotificationPrefs = {
  mute_types: string[];
  browser_enabled: boolean;
  sound_enabled: boolean;
  dnd_start: string | null;
  dnd_end: string | null;
};

const DEFAULTS: NotificationPrefs = {
  mute_types: [],
  browser_enabled: true,
  sound_enabled: false,
  dnd_start: null,
  dnd_end: null,
};

export const getNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }): Promise<NotificationPrefs> => {
    const { data: row } = await context.supabase
      .from("notification_preferences")
      .select("mute_types, browser_enabled, sound_enabled, dnd_start, dnd_end")
      .eq("user_id", context.userId!)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (!row) return DEFAULTS;
    return {
      mute_types: (row.mute_types as string[]) ?? [],
      browser_enabled: row.browser_enabled,
      sound_enabled: row.sound_enabled,
      dnd_start: row.dnd_start,
      dnd_end: row.dnd_end,
    };
  });

export const updateNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        mute_types: z.array(z.string().max(80)).max(50).optional(),
        browser_enabled: z.boolean().optional(),
        sound_enabled: z.boolean().optional(),
        dnd_start: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
        dnd_end: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { organization_id, ...patch } = data;
    const { error } = await context.supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: context.userId!,
          organization_id,
          ...patch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,organization_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
