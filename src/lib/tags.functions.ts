import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const COLORS = ["slate", "red", "orange", "amber", "yellow", "green", "teal", "blue", "indigo", "purple", "pink"] as const;

export const listTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [tagsRes, taggingsRes] = await Promise.all([
      supabase
        .from("tags")
        .select("id, name, color, created_at")
        .eq("organization_id", data.organization_id)
        .order("name"),
      supabase
        .from("taggings")
        .select("tag_id, entity_type")
        .eq("organization_id", data.organization_id),
    ]);

    const counts = new Map<string, { contact: number; company: number; deal: number; total: number }>();
    for (const t of taggingsRes.data ?? []) {
      const k = t.tag_id as string;
      const cur = counts.get(k) ?? { contact: 0, company: 0, deal: 0, total: 0 };
      const et = t.entity_type as "contact" | "company" | "deal";
      cur[et] = (cur[et] ?? 0) + 1;
      cur.total += 1;
      counts.set(k, cur);
    }

    return {
      tags: (tagsRes.data ?? []).map((t) => ({
        ...t,
        usage: counts.get(t.id) ?? { contact: 0, company: 0, deal: 0, total: 0 },
      })),
    };
  });

export const createTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        name: z.string().min(1).max(40),
        color: z.enum(COLORS).default("slate"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error, data: row } = await supabase
      .from("tags")
      .insert({
        organization_id: data.organization_id,
        name: data.name.trim(),
        color: data.color,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { tag: row };
  });

export const updateTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        organization_id: z.string().uuid(),
        name: z.string().min(1).max(40).optional(),
        color: z.enum(COLORS).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: { name?: string; color?: string } = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.color !== undefined) patch.color = data.color;
    const { error } = await supabase
      .from("tags")
      .update(patch)
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), organization_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("tags")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const mergeTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        source_id: z.string().uuid(),
        target_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.source_id === data.target_id) throw new Error("Tags iguais");

    const { data: srcRows } = await supabase
      .from("taggings")
      .select("entity_type, entity_id")
      .eq("organization_id", data.organization_id)
      .eq("tag_id", data.source_id);

    for (const r of srcRows ?? []) {
      await supabase.from("taggings").upsert(
        {
          organization_id: data.organization_id,
          tag_id: data.target_id,
          entity_type: r.entity_type,
          entity_id: r.entity_id,
        },
        { onConflict: "tag_id,entity_type,entity_id" },
      );
    }
    await supabase.from("tags").delete().eq("id", data.source_id);
    return { ok: true, merged: srcRows?.length ?? 0 };
  });
