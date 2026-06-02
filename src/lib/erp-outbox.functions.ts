import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Entity = z.enum(["customers", "sales_reps", "sales_history", "contacts", "companies", "orders"]);
const Action = z.enum(["create", "update", "delete"]);
const Status = z.enum(["pending", "running", "succeeded", "failed", "needs_manual", "cancelled"]);

export const enqueueOutbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      integration_id: z.string().uuid(),
      entity: Entity,
      action: Action,
      external_id: z.string().max(200).nullable().optional(),
      payload: z.record(z.string(), z.any()).default({}),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("erp_outbox")
      .insert({
        organization_id: data.organization_id,
        integration_id: data.integration_id,
        entity: data.entity,
        action: data.action,
        external_id: data.external_id ?? null,
        payload: data.payload,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listOutbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      status: Status.optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("erp_outbox")
      .select("id,integration_id,entity,action,external_id,status,attempts,max_attempts,last_error,scheduled_at,created_at,payload")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const resolveOutbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      strategy: z.enum(["retry", "cancel", "mark_succeeded"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const nowIso = new Date().toISOString();
    const patch =
      data.strategy === "retry"
        ? { status: "pending", attempts: 0, last_error: null, scheduled_at: nowIso }
        : data.strategy === "cancel"
        ? { status: "cancelled", finished_at: nowIso }
        : { status: "succeeded", finished_at: nowIso };
    const { error } = await context.supabase.from("erp_outbox").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveOutboxBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      strategy: z.enum(["retry", "cancel", "mark_succeeded"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const nowIso = new Date().toISOString();
    const patch =
      data.strategy === "retry"
        ? { status: "pending", attempts: 0, last_error: null, scheduled_at: nowIso }
        : data.strategy === "cancel"
        ? { status: "cancelled", finished_at: nowIso }
        : { status: "succeeded", finished_at: nowIso };
    const { error, count } = await context.supabase
      .from("erp_outbox")
      .update(patch, { count: "exact" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: count ?? data.ids.length };
  });
