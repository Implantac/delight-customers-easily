import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        only_unread: z.boolean().default(false),
        limit: z.number().min(1).max(200).default(100),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .eq("organization_id", data.organization_id)
      .eq("user_id", userId!)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.only_unread) q = q.is("read_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { count: unreadCount } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", data.organization_id)
      .eq("user_id", userId!)
      .is("read_at", null);

    return { items: rows ?? [], unread: unreadCount ?? 0 };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", data.ids)
      .eq("user_id", userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("organization_id", data.organization_id)
      .eq("user_id", userId!)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId!);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
