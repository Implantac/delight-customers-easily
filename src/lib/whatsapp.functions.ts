import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });

export type WAConversation = {
  id: string;
  contact_name: string;
  contact_phone: string;
  contact_id: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  status: "open" | "pending" | "resolved";
  priority: "low" | "normal" | "high" | "urgent";
  unread_count: number;
  last_message_at: string;
  last_customer_message_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  first_message_at: string;
  last_message_preview: string | null;
};

export type WAMessage = {
  id: string;
  direction: "in" | "out";
  body: string;
  status: "sent" | "delivered" | "read" | "failed";
  sender_user_id: string | null;
  sender_name: string | null;
  created_at: string;
};

export const listWAConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    orgInput
      .extend({
        status: z.enum(["all", "open", "pending", "resolved", "mine", "unassigned"]).default("all"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("whatsapp_conversations")
      .select(
        "id, contact_name, contact_phone, contact_id, assigned_to, status, priority, unread_count, last_message_at, last_customer_message_at, first_response_at, resolved_at, first_message_at",
      )
      .eq("organization_id", data.organization_id)
      .order("last_message_at", { ascending: false })
      .limit(200);

    if (data.status === "mine") q = q.eq("assigned_to", userId);
    else if (data.status === "unassigned") q = q.is("assigned_to", null);
    else if (data.status !== "all") q = q.eq("status", data.status);

    const { data: convs, error } = await q;
    if (error) throw new Error(error.message);
    const rows = convs ?? [];
    if (rows.length === 0) return [] as WAConversation[];

    const ids = rows.map((r) => r.id);
    const userIds = Array.from(new Set(rows.map((r) => r.assigned_to).filter(Boolean) as string[]));

    const [profilesRes, lastMsgsRes] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", userIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }>, error: null }),
      supabase
        .from("whatsapp_messages")
        .select("conversation_id, body, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    const profMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
    const lastMsg = new Map<string, string>();
    for (const m of lastMsgsRes.data ?? []) {
      if (!lastMsg.has(m.conversation_id)) lastMsg.set(m.conversation_id, m.body);
    }

    return rows.map<WAConversation>((r) => ({
      id: r.id,
      contact_name: r.contact_name,
      contact_phone: r.contact_phone,
      contact_id: r.contact_id,
      assigned_to: r.assigned_to,
      assigned_name: r.assigned_to ? profMap.get(r.assigned_to) ?? null : null,
      status: r.status as WAConversation["status"],
      priority: r.priority as WAConversation["priority"],
      unread_count: r.unread_count,
      last_message_at: r.last_message_at,
      last_customer_message_at: r.last_customer_message_at,
      first_response_at: r.first_response_at,
      resolved_at: r.resolved_at,
      first_message_at: r.first_message_at,
      last_message_preview: lastMsg.get(r.id) ?? null,
    }));
  });

export const getWAMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msgs, error } = await supabase
      .from("whatsapp_messages")
      .select("id, direction, body, status, sender_user_id, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((msgs ?? []).map((m) => m.sender_user_id).filter(Boolean) as string[]));
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
    const profMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    return (msgs ?? []).map<WAMessage>((m) => ({
      id: m.id,
      direction: m.direction as "in" | "out",
      body: m.body,
      status: m.status as WAMessage["status"],
      sender_user_id: m.sender_user_id,
      sender_name: m.sender_user_id ? profMap.get(m.sender_user_id) ?? null : null,
      created_at: m.created_at,
    }));
  });

export const sendWAMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        organization_id: z.string().uuid(),
        body: z.string().min(1).max(4000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("whatsapp_messages").insert({
      conversation_id: data.conversation_id,
      organization_id: data.organization_id,
      direction: "out",
      body: data.body,
      sender_user_id: userId,
      status: "sent",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const simulateIncomingWA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        organization_id: z.string().uuid(),
        body: z.string().min(1).max(4000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("whatsapp_messages").insert({
      conversation_id: data.conversation_id,
      organization_id: data.organization_id,
      direction: "in",
      body: data.body,
      status: "delivered",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createWAConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        contact_name: z.string().min(1).max(200),
        contact_phone: z.string().min(5).max(40),
        contact_id: z.string().uuid().nullable().optional(),
        first_message: z.string().min(1).max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: conv, error } = await supabase
      .from("whatsapp_conversations")
      .insert({
        organization_id: data.organization_id,
        contact_name: data.contact_name,
        contact_phone: data.contact_phone,
        contact_id: data.contact_id ?? null,
        assigned_to: userId,
        status: "open",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (data.first_message) {
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conv.id,
        organization_id: data.organization_id,
        direction: "in",
        body: data.first_message,
        status: "delivered",
      });
    }
    return { id: conv.id };
  });

export const updateWAConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "pending", "resolved"]).optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        assigned_to: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Record<string, unknown> = {};
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "resolved") patch.resolved_at = new Date().toISOString();
      else patch.resolved_at = null;
    }
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.assigned_to !== undefined) patch.assigned_to = data.assigned_to;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("whatsapp_conversations").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markWARead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type WASlaMetrics = {
  total: number;
  open: number;
  pending: number;
  resolved: number;
  unassigned: number;
  avg_first_response_minutes: number | null;
  avg_resolution_minutes: number | null;
  sla_breaches_15min: number;
};

export const getWASlaMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("whatsapp_conversations")
      .select("status, assigned_to, first_message_at, first_response_at, resolved_at, last_customer_message_at")
      .eq("organization_id", data.organization_id)
      .limit(1000);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const m: WASlaMetrics = {
      total: list.length,
      open: 0,
      pending: 0,
      resolved: 0,
      unassigned: 0,
      avg_first_response_minutes: null,
      avg_resolution_minutes: null,
      sla_breaches_15min: 0,
    };
    const respTimes: number[] = [];
    const resTimes: number[] = [];
    const now = Date.now();
    for (const r of list) {
      if (r.status === "open") m.open++;
      else if (r.status === "pending") m.pending++;
      else if (r.status === "resolved") m.resolved++;
      if (!r.assigned_to) m.unassigned++;
      if (r.first_message_at && r.first_response_at) {
        respTimes.push((new Date(r.first_response_at).getTime() - new Date(r.first_message_at).getTime()) / 60000);
      } else if (r.last_customer_message_at && !r.first_response_at) {
        const waiting = (now - new Date(r.last_customer_message_at).getTime()) / 60000;
        if (waiting > 15) m.sla_breaches_15min++;
      }
      if (r.first_message_at && r.resolved_at) {
        resTimes.push((new Date(r.resolved_at).getTime() - new Date(r.first_message_at).getTime()) / 60000);
      }
    }
    if (respTimes.length) m.avg_first_response_minutes = Math.round(respTimes.reduce((a, b) => a + b, 0) / respTimes.length);
    if (resTimes.length) m.avg_resolution_minutes = Math.round(resTimes.reduce((a, b) => a + b, 0) / resTimes.length);
    return m;
  });

export const listOrgMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: members, error } = await supabase
      .from("memberships")
      .select("user_id, role")
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
    const profMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    return (members ?? []).map((m) => ({
      user_id: m.user_id,
      role: m.role as string,
      full_name: profMap.get(m.user_id) ?? null,
    }));
  });
  });

export const listWATemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: tmpls, error } = await supabase
      .from("message_templates")
      .select("id, name, category, body, channel")
      .eq("organization_id", data.organization_id)
      .in("channel", ["whatsapp", "sms", "email"])
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return tmpls ?? [];
  });
