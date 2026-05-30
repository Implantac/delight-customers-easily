import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; folder_id?: string | null; search?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [foldersRes, docsRes] = await Promise.all([
      supabase
        .from("document_folders")
        .select("*")
        .eq("organization_id", data.organization_id)
        .order("name"),
      (async () => {
        let q = supabase
          .from("documents")
          .select("*")
          .eq("organization_id", data.organization_id)
          .order("updated_at", { ascending: false })
          .limit(500);
        if (data.folder_id === null) q = q.is("folder_id", null);
        else if (data.folder_id) q = q.eq("folder_id", data.folder_id);
        if (data.search) q = q.ilike("name", `%${data.search}%`);
        return q;
      })(),
    ]);
    if (foldersRes.error) throw new Error(foldersRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);

    const docs = docsRes.data ?? [];
    const totals = {
      documents: docs.length,
      total_size: docs.reduce((s: number, d: any) => s + (d.size_bytes ?? 0), 0),
      folders: (foldersRes.data ?? []).length,
    };
    return { folders: foldersRes.data ?? [], documents: docs, totals };
  });

export const upsertFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; organization_id: string; name: string; parent_id?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      organization_id: data.organization_id,
      name: data.name,
      parent_id: data.parent_id ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("document_folders").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("document_folders")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("document_folders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    folder_id?: string | null;
    name: string;
    description?: string | null;
    url: string;
    mime_type?: string | null;
    size_bytes?: number;
    tags?: string[];
    company_id?: string | null;
    contact_id?: string | null;
    deal_id?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      organization_id: data.organization_id,
      folder_id: data.folder_id ?? null,
      name: data.name,
      description: data.description ?? null,
      url: data.url,
      mime_type: data.mime_type ?? null,
      size_bytes: data.size_bytes ?? 0,
      tags: data.tags ?? [],
      company_id: data.company_id ?? null,
      contact_id: data.contact_id ?? null,
      deal_id: data.deal_id ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("documents").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("documents")
      .insert({ ...payload, uploaded_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addDocumentVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    document_id: string;
    organization_id: string;
    url: string;
    size_bytes?: number;
    notes?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, version, url, size_bytes")
      .eq("id", data.document_id)
      .single();
    if (docErr) throw new Error(docErr.message);
    const oldVersion = doc!.version ?? 1;

    // Archive current as previous version
    await supabase.from("document_versions").insert({
      document_id: data.document_id,
      organization_id: data.organization_id,
      version: oldVersion,
      url: doc!.url,
      size_bytes: doc!.size_bytes ?? 0,
      notes: data.notes ?? null,
      uploaded_by: userId,
    });

    const newVersion = oldVersion + 1;
    const { error: updErr } = await supabase
      .from("documents")
      .update({
        version: newVersion,
        url: data.url,
        size_bytes: data.size_bytes ?? 0,
      })
      .eq("id", data.document_id);
    if (updErr) throw new Error(updErr.message);
    return { version: newVersion };
  });

export const listDocumentVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { document_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("document_versions")
      .select("*")
      .eq("document_id", data.document_id)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return { versions: rows ?? [] };
  });
