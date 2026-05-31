import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "artigo";

export const listArticles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        search: z.string().max(200).optional(),
        category: z.string().max(80).optional(),
        status: z.enum(["draft", "published", "archived", "all"]).default("all"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("kb_articles")
      .select("id, title, slug, category, tags, status, views, updated_at, author_id")
      .eq("organization_id", data.organization_id)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.category) q = q.eq("category", data.category);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { data: cats } = await supabase
      .from("kb_articles")
      .select("category")
      .eq("organization_id", data.organization_id)
      .not("category", "is", null);
    const categories = Array.from(
      new Set((cats ?? []).map((c) => c.category).filter(Boolean) as string[]),
    ).sort();

    return { articles: rows ?? [], categories };
  });

export const getArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), organization_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("kb_articles")
      .select("*")
      .eq("id", data.id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Artigo não encontrado");
    await supabase
      .from("kb_articles")
      .update({ views: (row.views ?? 0) + 1 })
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    return { article: row };
  });

export const upsertArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organization_id: z.string().uuid(),
        title: z.string().min(1).max(200),
        content: z.string().max(100_000).default(""),
        category: z.string().max(80).nullable().optional(),
        tags: z.array(z.string().min(1).max(40)).max(20).default([]),
        status: z.enum(["draft", "published", "archived"]).default("draft"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("kb_articles")
        .update({
          title: data.title,
          content: data.content,
          category: data.category ?? null,
          tags: data.tags,
          status: data.status,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const baseSlug = slugify(data.title);
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
    const { data: row, error } = await supabase
      .from("kb_articles")
      .insert({
        organization_id: data.organization_id,
        author_id: userId!,
        title: data.title,
        slug,
        content: data.content,
        category: data.category ?? null,
        tags: data.tags,
        status: data.status,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), organization_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("kb_articles")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
