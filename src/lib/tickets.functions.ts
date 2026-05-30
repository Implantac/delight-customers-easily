import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUS = z.enum(["open", "in_progress", "pending", "resolved", "closed"]);
const PRIORITY = z.enum(["low", "normal", "high", "urgent"]);

export const listTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        status: z.union([STATUS, z.literal("all")]).default("all"),
        assignee: z.union([z.string().uuid(), z.literal("me"), z.literal("all")]).default("all"),
        search: z.string().max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("tickets")
      .select("id, subject, status, priority, channel, contact_id, assignee_id, created_at, updated_at, resolved_at")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.assignee === "me") q = q.eq("assignee_id", userId!);
    else if (data.assignee !== "all") q = q.eq("assignee_id", data.assignee);
    if (data.search) q = q.ilike("subject", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const counts: Record<string, number> = {
      open: 0, in_progress: 0, pending: 0, resolved: 0, closed: 0, total: 0,
    };
    const { data: all } = await supabase
      .from("tickets")
      .select("status")
      .eq("organization_id", data.organization_id);
    for (const t of all ?? []) {
      counts[t.status as string] = (counts[t.status as string] ?? 0) + 1;
      counts.total += 1;
    }

    const contactIds = Array.from(
      new Set((rows ?? []).map((r) => r.contact_id).filter(Boolean) as string[]),
    );
    let contacts = new Map<string, string>();
    if (contactIds.length) {
      const { data: cs } = await supabase
        .from("contacts")
        .select("id, name")
        .in("id", contactIds);
      for (const c of cs ?? []) contacts.set(c.id, c.name ?? "Contato");
    }

    return {
      tickets: (rows ?? []).map((r) => ({
        ...r,
        contact_name: r.contact_id ? contacts.get(r.contact_id) ?? null : null,
      })),
      counts,
    };
  });

export const getTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [ticketRes, commentsRes] = await Promise.all([
      supabase.from("tickets").select("*").eq("id", data.id).maybeSingle(),
      supabase
        .from("ticket_comments")
        .select("id, author_id, body, is_internal, created_at")
        .eq("ticket_id", data.id)
        .order("created_at", { ascending: true }),
    ]);
    if (ticketRes.error) throw new Error(ticketRes.error.message);
    if (!ticketRes.data) throw new Error("Ticket não encontrado");

    const authorIds = Array.from(
      new Set((commentsRes.data ?? []).map((c) => c.author_id)),
    );
    let authorMap = new Map<string, string>();
    if (authorIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      for (const p of profs ?? []) authorMap.set(p.id, p.full_name ?? "Usuário");
    }

    return {
      ticket: ticketRes.data,
      comments: (commentsRes.data ?? []).map((c) => ({
        ...c,
        author_name: authorMap.get(c.author_id) ?? "Usuário",
      })),
    };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        subject: z.string().min(1).max(200),
        description: z.string().max(10_000).optional(),
        contact_id: z.string().uuid().nullable().optional(),
        priority: PRIORITY.default("normal"),
        channel: z.string().max(40).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("tickets")
      .insert({
        organization_id: data.organization_id,
        created_by: userId!,
        subject: data.subject,
        description: data.description ?? null,
        contact_id: data.contact_id ?? null,
        priority: data.priority,
        channel: data.channel ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        status: STATUS.optional(),
        priority: PRIORITY.optional(),
        assignee_id: z.string().uuid().nullable().optional(),
        subject: z.string().min(1).max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, any> = {};
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "resolved") patch.resolved_at = new Date().toISOString();
      if (data.status === "closed") patch.closed_at = new Date().toISOString();
    }
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.assignee_id !== undefined) patch.assignee_id = data.assignee_id;
    if (data.subject !== undefined) patch.subject = data.subject;
    const { error } = await supabase.from("tickets").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        ticket_id: z.string().uuid(),
        body: z.string().min(1).max(10_000),
        is_internal: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("ticket_comments").insert({
      organization_id: data.organization_id,
      ticket_id: data.ticket_id,
      author_id: userId!,
      body: data.body,
      is_internal: data.is_internal,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
