import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CalendarActivity = {
  id: string;
  type: string;
  title: string;
  due_date: string;
  completed: boolean;
  user_id: string;
  contact_id: string | null;
  deal_id: string | null;
};

export const getCalendarActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        from: z.string(),
        to: z.string(),
        mine_only: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("activities")
      .select("id, type, title, due_date, completed, user_id, contact_id, deal_id")
      .eq("organization_id", data.organization_id)
      .gte("due_date", data.from)
      .lt("due_date", data.to)
      .order("due_date", { ascending: true })
      .limit(1000);
    if (data.mine_only) q = q.eq("user_id", userId!);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { activities: (rows ?? []) as CalendarActivity[] };
  });

export const toggleActivityComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), completed: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("activities")
      .update({ completed: data.completed })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
