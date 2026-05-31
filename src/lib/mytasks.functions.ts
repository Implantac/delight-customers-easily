import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyTask = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  contact_id: string | null;
  deal_id: string | null;
  created_at: string;
};

export const listMyTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        include_completed: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("activities")
      .select("id, type, title, description, due_date, completed, contact_id, deal_id, created_at")
      .eq("organization_id", data.organization_id)
      .eq("user_id", userId!)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500);
    if (!data.include_completed) q = q.eq("completed", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { tasks: (rows ?? []) as MyTask[] };
  });

export const setTaskCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      organization_id: z.string().uuid(),
      completed: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("activities")
      .update({ completed: data.completed })
      .eq("id", data.id)
      .eq("organization_id", data.organization_id)
      .eq("user_id", userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const snoozeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      organization_id: z.string().uuid(),
      due_date: z.string(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("activities")
      .update({ due_date: data.due_date })
      .eq("id", data.id)
      .eq("organization_id", data.organization_id)
      .eq("user_id", userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const quickAddTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        title: z.string().min(1).max(255),
        due_date: z.string().nullable(),
        type: z.enum(["call", "email", "task", "meeting", "note"]).default("task"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("activities").insert({
      organization_id: data.organization_id,
      user_id: userId!,
      title: data.title,
      due_date: data.due_date,
      type: data.type,
      completed: false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
