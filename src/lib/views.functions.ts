import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ENTITY = z.enum(["contacts", "companies", "deals", "activities"]);

export const listViews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        entity: ENTITY.optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("saved_views")
      .select("id, entity, name, filters, is_shared, user_id, updated_at")
      .eq("organization_id", data.organization_id)
      .order("updated_at", { ascending: false });
    if (data.entity) q = q.eq("entity", data.entity);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return {
      views: (rows ?? []).map((r) => ({ ...r, mine: r.user_id === userId })),
    };
  });

export const createView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        entity: ENTITY,
        name: z.string().min(1).max(60),
        filters: z.record(z.string(), z.unknown()).default({}),
        is_shared: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("saved_views")
      .insert({
        organization_id: data.organization_id,
        user_id: userId!,
        entity: data.entity,
        name: data.name.trim(),
        filters: data.filters as any,
        is_shared: data.is_shared,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { view: row };
  });

export const updateView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        organization_id: z.string().uuid(),
        name: z.string().min(1).max(60).optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
        is_shared: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, any> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.filters !== undefined) patch.filters = data.filters;
    if (data.is_shared !== undefined) patch.is_shared = data.is_shared;
    const { error } = await supabase
      .from("saved_views")
      .update(patch as any)
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), organization_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("saved_views")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
