import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Check-in rápido do representante em campo.
 * Registra uma activity tipo 'visit' marcada como completed=true,
 * com lat/lng do dispositivo armazenadas na description.
 *
 * Opcionalmente vincula a um contact_id (cliente sendo visitado).
 */
export const createCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        contact_id: z.string().uuid().nullable().optional(),
        title: z.string().min(1).max(255).default("Check-in"),
        notes: z.string().max(2000).optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        accuracy_m: z.number().min(0).max(100000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const parts: string[] = [];
    if (data.latitude != null && data.longitude != null) {
      parts.push(`📍 ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`);
      if (data.accuracy_m != null) parts.push(`(±${Math.round(data.accuracy_m)}m)`);
      parts.push(
        `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`,
      );
    } else {
      parts.push("Check-in sem localização (GPS indisponível).");
    }
    if (data.notes) parts.push("", data.notes);

    const { data: row, error } = await supabase
      .from("activities")
      .insert({
        organization_id: data.organization_id,
        user_id: userId,
        contact_id: data.contact_id ?? null,
        type: "visit",
        title: data.title,
        description: parts.join("\n"),
        completed: true,
        due_date: now,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: row.id, created_at: now };
  });
