import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Step = { id?: string; title: string; description?: string | null; due_offset_days?: number; done?: boolean; done_at?: string | null };

function recomputeProgress(steps: Step[]): { pct: number; done: number; total: number } {
  const total = steps.length;
  const done = steps.filter((s) => s.done).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export const listOnboardingTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("onboarding_templates").select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { templates: rows ?? [] };
  });

export const upsertOnboardingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    name: string;
    description?: string | null;
    duration_days: number;
    steps: Step[];
    is_active?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      organization_id: data.organization_id,
      name: data.name,
      description: data.description ?? null,
      duration_days: data.duration_days,
      steps: data.steps,
      is_active: data.is_active ?? true,
    };
    if (data.id) {
      const { error } = await supabase.from("onboarding_templates").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: r, error } = await supabase
      .from("onboarding_templates").insert({ ...payload, created_by: userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: r.id };
  });

export const deleteOnboardingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("onboarding_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOnboardingProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; status?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("onboarding_projects")
      .select("*, companies(name), onboarding_templates(name)")
      .eq("organization_id", data.organization_id)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(500);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const all = rows ?? [];
    const now = Date.now();
    // Auto-mark late projects' health
    for (const p of all) {
      if (p.status === "in_progress" && p.due_at && new Date(p.due_at).getTime() < now && p.progress_pct < 100) {
        p.health = "red";
      }
    }
    const totals = {
      not_started: all.filter((p: any) => p.status === "not_started").length,
      in_progress: all.filter((p: any) => p.status === "in_progress").length,
      completed: all.filter((p: any) => p.status === "completed").length,
      late: all.filter((p: any) => p.status === "in_progress" && p.health === "red").length,
      avg_progress: all.length
        ? Math.round(all.reduce((s: number, p: any) => s + (p.progress_pct ?? 0), 0) / all.length)
        : 0,
    };
    return { projects: all, totals };
  });

export const createOnboardingProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    template_id?: string | null;
    company_id?: string | null;
    contact_id?: string | null;
    name: string;
    owner_id?: string | null;
    started_at?: string | null;
    notes?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let steps: Step[] = [];
    let duration = 30;
    if (data.template_id) {
      const { data: tpl } = await supabase
        .from("onboarding_templates").select("steps, duration_days").eq("id", data.template_id).single();
      if (tpl) {
        steps = (tpl.steps as Step[] ?? []).map((s, i) => ({ ...s, id: s.id ?? String(i), done: false, done_at: null }));
        duration = tpl.duration_days;
      }
    }
    const started = data.started_at || new Date().toISOString().slice(0, 10);
    const due = new Date(started);
    due.setDate(due.getDate() + duration);
    const { data: r, error } = await supabase
      .from("onboarding_projects").insert({
        organization_id: data.organization_id,
        template_id: data.template_id ?? null,
        company_id: data.company_id ?? null,
        contact_id: data.contact_id ?? null,
        name: data.name,
        owner_id: data.owner_id ?? userId,
        steps,
        progress_pct: 0,
        status: "not_started",
        started_at: started,
        due_at: due.toISOString().slice(0, 10),
        notes: data.notes ?? null,
        created_by: userId,
      }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: r.id };
  });

export const toggleProjectStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { project_id: string; step_id: string; done: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: proj, error } = await supabase
      .from("onboarding_projects").select("steps, status").eq("id", data.project_id).single();
    if (error) throw new Error(error.message);
    const steps = (proj.steps as Step[] ?? []).map((s, i) =>
      String(s.id ?? i) === data.step_id
        ? { ...s, done: data.done, done_at: data.done ? new Date().toISOString() : null }
        : s
    );
    const { pct } = recomputeProgress(steps);
    let status = proj.status;
    if (pct === 100) status = "completed";
    else if (pct > 0 && status === "not_started") status = "in_progress";
    const patch: any = { steps, progress_pct: pct, status };
    if (status === "completed") patch.completed_at = new Date().toISOString();
    const { error: e2 } = await supabase.from("onboarding_projects").update(patch).eq("id", data.project_id);
    if (e2) throw new Error(e2.message);
    return { ok: true, pct };
  });

export const updateProjectStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "not_started" | "in_progress" | "completed" | "cancelled"; notes?: string }) => d)
  .handler(async ({ data, context }) => {
    const patch: any = { status: data.status };
    if (data.status === "completed") patch.completed_at = new Date().toISOString();
    if (data.notes != null) patch.notes = data.notes;
    const { error } = await context.supabase.from("onboarding_projects").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOnboardingProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("onboarding_projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
