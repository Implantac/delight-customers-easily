import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPlaybooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [pbs, items] = await Promise.all([
      supabase.from("playbooks").select("*").eq("organization_id", data.organization_id).order("name"),
      supabase.from("playbook_items").select("*").eq("organization_id", data.organization_id).order("position"),
    ]);
    if (pbs.error) throw new Error(pbs.error.message);
    if (items.error) throw new Error(items.error.message);
    return { playbooks: pbs.data ?? [], items: items.data ?? [] };
  });

export const upsertPlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organization_id: z.string().uuid(),
        name: z.string().min(1).max(160),
        description: z.string().max(2000).nullable().optional(),
        stage: z.string().max(64).nullable().optional(),
        active: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = { ...data };
    if (!payload.id) payload.created_by = userId;
    const { data: row, error } = await supabase
      .from("playbooks")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("playbooks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertPlaybookItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organization_id: z.string().uuid(),
        playbook_id: z.string().uuid(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).nullable().optional(),
        position: z.number().int().min(0).max(1000).default(0),
        required: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("playbook_items")
      .upsert(data, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePlaybookItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("playbook_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const startPlaybookRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        playbook_id: z.string().uuid(),
        deal_id: z.string().uuid().nullable().optional(),
        contact_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: run, error } = await supabase
      .from("playbook_runs")
      .insert({
        organization_id: data.organization_id,
        playbook_id: data.playbook_id,
        deal_id: data.deal_id ?? null,
        contact_id: data.contact_id ?? null,
        started_by: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { data: items } = await supabase
      .from("playbook_items")
      .select("id")
      .eq("playbook_id", data.playbook_id);
    if (items && items.length) {
      const rows = items.map((it: any) => ({
        run_id: run.id,
        organization_id: data.organization_id,
        item_id: it.id,
      }));
      await supabase.from("playbook_run_items").insert(rows);
    }
    return run;
  });

export const listPlaybookRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        status: z.enum(["all", "active", "completed", "abandoned"]).default("active"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("playbook_runs")
      .select("*, playbooks:playbooks(id, name), deals:deals(id, title), contacts:contacts(id, first_name, last_name)")
      .eq("organization_id", data.organization_id)
      .order("started_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const runIds = (rows ?? []).map((r: any) => r.id);
    let progress: Record<string, { total: number; done: number }> = {};
    if (runIds.length) {
      const { data: ri } = await supabase
        .from("playbook_run_items")
        .select("run_id, completed")
        .in("run_id", runIds);
      for (const r of ri ?? []) {
        if (!progress[r.run_id]) progress[r.run_id] = { total: 0, done: 0 };
        progress[r.run_id].total++;
        if (r.completed) progress[r.run_id].done++;
      }
    }
    return { runs: rows ?? [], progress };
  });

export const getPlaybookRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: run, error } = await supabase
      .from("playbook_runs")
      .select("*, playbooks:playbooks(id, name, description)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: items } = await supabase
      .from("playbook_run_items")
      .select("*, playbook_items:playbook_items(id, title, description, position, required)")
      .eq("run_id", data.id);
    const sorted = (items ?? []).sort(
      (a: any, b: any) => (a.playbook_items?.position ?? 0) - (b.playbook_items?.position ?? 0),
    );
    return { run, items: sorted };
  });

export const toggleRunItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), completed: z.boolean(), note: z.string().max(1000).nullable().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("playbook_run_items")
      .update({
        completed: data.completed,
        completed_at: data.completed ? new Date().toISOString() : null,
        completed_by: data.completed ? userId : null,
        note: data.note ?? null,
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const finishPlaybookRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), status: z.enum(["completed", "abandoned"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("playbook_runs")
      .update({ status: data.status, completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
