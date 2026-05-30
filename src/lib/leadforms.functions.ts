import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listLeadForms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: forms, error } = await supabase
      .from("lead_forms")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { forms: forms ?? [] };
  });

export const getLeadFormWithSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: form, error } = await supabase
      .from("lead_forms").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: subs } = await supabase
      .from("lead_form_submissions").select("*").eq("form_id", data.id)
      .order("created_at", { ascending: false }).limit(200);
    return { form, submissions: subs ?? [] };
  });

export const upsertLeadForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    slug: string;
    name: string;
    description?: string | null;
    fields: { key: string; label: string; type: string; required?: boolean; placeholder?: string }[];
    active: boolean;
    redirect_url?: string | null;
    success_message?: string | null;
    create_contact: boolean;
    create_deal: boolean;
    default_source?: string | null;
    notify_emails?: string[] | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slug = data.slug.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) throw new Error("Slug inválido");
    const payload: any = {
      organization_id: data.organization_id,
      slug,
      name: data.name,
      description: data.description ?? null,
      fields: data.fields,
      active: data.active,
      redirect_url: data.redirect_url ?? null,
      success_message: data.success_message ?? null,
      create_contact: data.create_contact,
      create_deal: data.create_deal,
      default_source: data.default_source ?? null,
      notify_emails: data.notify_emails && data.notify_emails.length ? data.notify_emails : null,
    };
    if (data.id) {
      const { error } = await supabase.from("lead_forms").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: r, error } = await supabase
      .from("lead_forms").insert({ ...payload, created_by: userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: r.id };
  });

export const deleteLeadForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lead_forms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLeadSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lead_form_submissions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
