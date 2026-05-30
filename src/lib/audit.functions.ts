import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  organization_id: z.string().uuid(),
  entity_type: z.string().optional(),
  user_id: z.string().uuid().optional(),
  action: z.string().optional(),
  limit: z.number().int().min(20).max(500).default(200),
});

export type AuditEntry = {
  id: string;
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: any;
};

export const getAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("audit_log")
      .select("id, created_at, user_id, action, entity_type, entity_id, changes")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.entity_type) q = q.eq("entity_type", data.entity_type);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    if (data.action) q = q.eq("action", data.action);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean) as string[]));
    const names: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name").in("id", userIds);
      for (const p of profs ?? []) names[(p as any).id] = (p as any).full_name ?? "—";
    }

    const items: AuditEntry[] = (rows ?? []).map((r: any) => ({
      id: r.id, created_at: r.created_at,
      user_id: r.user_id, user_name: r.user_id ? names[r.user_id] ?? null : null,
      action: r.action, entity_type: r.entity_type, entity_id: r.entity_id,
      changes: (r.changes ?? null) as any,
    }));

    // distinct facets
    const facets = {
      entities: Array.from(new Set(items.map((i) => i.entity_type))).sort(),
      actions: Array.from(new Set(items.map((i) => i.action))).sort(),
    };

    return { items, facets };
  });
