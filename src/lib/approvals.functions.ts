import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Approval = {
  id: string;
  organization_id: string;
  requester_id: string;
  approver_id: string | null;
  type: string;
  title: string;
  description: string | null;
  amount: number | null;
  currency: string | null;
  reference_type: string | null;
  reference_id: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
};

export const listApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        status: z.enum(["all", "pending", "approved", "rejected", "cancelled"]).default("all"),
        scope: z.enum(["all", "mine"]).default("all"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("approvals")
      .select("id, organization_id, requester_id, approver_id, type, title, description, amount, currency, reference_type, reference_id, status, decision_note, decided_at, created_at")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.scope === "mine") q = q.eq("requester_id", userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0, total: rows?.length ?? 0 };
    for (const r of rows ?? []) counts[r.status as keyof typeof counts]++;

    return { approvals: (rows ?? []) as Approval[], counts };
  });

export const createApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        type: z.enum(["discount", "proposal", "contract", "refund", "expense", "other"]),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).nullable().optional(),
        amount: z.number().min(0).max(1e12).nullable().optional(),
        currency: z.string().max(8).default("BRL"),
        reference_type: z.string().max(64).nullable().optional(),
        reference_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("approvals")
      .insert({ ...data, requester_id: userId, status: "pending" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        decision_note: z.string().max(1000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("approvals")
      .update({
        status: data.decision,
        approver_id: userId,
        decision_note: data.decision_note ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const cancelApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("approvals")
      .update({ status: "cancelled", decided_at: new Date().toISOString() })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
