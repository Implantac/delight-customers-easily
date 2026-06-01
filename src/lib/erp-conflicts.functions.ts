import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Resolution = z.enum(["use_crm", "use_erp", "merge", "ignore"]);

export const listConflicts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      only_open: z.boolean().default(true),
      limit: z.number().int().min(1).max(200).default(100),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("erp_sync_conflicts")
      .select(
        "id,integration_id,resource,external_id,field,crm_value,erp_value,resolution,resolved_at,detected_at,notes",
      )
      .eq("organization_id", data.organization_id)
      .order("detected_at", { ascending: false })
      .limit(data.limit);
    if (data.only_open) q = q.is("resolved_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const resolveConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      resolution: Resolution,
      notes: z.string().max(1000).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("erp_sync_conflicts")
      .update({
        resolution: data.resolution,
        resolved_at: new Date().toISOString(),
        resolved_by: context.userId,
        notes: data.notes ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
