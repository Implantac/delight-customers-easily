import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes } from "crypto";

const orgInput = z.object({ organization_id: z.string().uuid() });

export const listSiteChatKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("site_chat_keys")
      .select("id, public_key, label, allowed_origins, is_active, created_at")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createSiteChatKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        label: z.string().trim().min(1).max(80),
        allowed_origins: z.array(z.string().trim().min(1).max(255)).max(20).default([]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const publicKey = "sk_pub_" + randomBytes(18).toString("hex");
    const { data: row, error } = await context.supabase
      .from("site_chat_keys")
      .insert({
        organization_id: data.organization_id,
        label: data.label,
        allowed_origins: data.allowed_origins,
        public_key: publicKey,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleSiteChatKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("site_chat_keys")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSiteChatSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("site_chat_sessions")
      .select("id, visitor_name, visitor_email, visitor_phone, page_url, status, last_message_at, unread_for_agent, created_at, lead_id")
      .eq("organization_id", data.organization_id)
      .order("last_message_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listSiteChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ session_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [sessionRes, msgsRes] = await Promise.all([
      context.supabase
        .from("site_chat_sessions")
        .select("id, organization_id, visitor_name, visitor_email, visitor_phone, page_url, referrer, status, created_at")
        .eq("id", data.session_id)
        .single(),
      context.supabase
        .from("site_chat_messages")
        .select("id, sender_kind, sender_user_id, body, created_at")
        .eq("session_id", data.session_id)
        .order("created_at", { ascending: true })
        .limit(500),
    ]);
    if (sessionRes.error) throw new Error(sessionRes.error.message);
    if (msgsRes.error) throw new Error(msgsRes.error.message);
    // mark read
    await context.supabase
      .from("site_chat_sessions")
      .update({ unread_for_agent: 0 })
      .eq("id", data.session_id);
    return { session: sessionRes.data, messages: msgsRes.data ?? [] };
  });

export const replySiteChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        session_id: z.string().uuid(),
        organization_id: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("site_chat_messages").insert({
      session_id: data.session_id,
      organization_id: data.organization_id,
      sender_kind: "agent",
      sender_user_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    await context.supabase
      .from("site_chat_sessions")
      .update({ last_message_at: new Date().toISOString(), unread_for_agent: 0 })
      .eq("id", data.session_id);
    return { ok: true };
  });

export const closeSiteChatSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ session_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("site_chat_sessions")
      .update({ status: "closed" })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const convertSiteChatToLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ session_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: s, error: e1 } = await context.supabase
      .from("site_chat_sessions")
      .select("id, organization_id, visitor_name, visitor_email, visitor_phone, page_url, lead_id")
      .eq("id", data.session_id)
      .single();
    if (e1) throw new Error(e1.message);
    if (s.lead_id) return { ok: true, lead_id: s.lead_id, already: true };

    const { data: lead, error: e2 } = await context.supabase
      .from("marketing_leads")
      .insert({
        organization_id: s.organization_id,
        channel: "site_chat",
        source: "widget",
        name: s.visitor_name || s.visitor_email || "Visitante do site",
        email: s.visitor_email,
        phone: s.visitor_phone,
        message: s.page_url ? `Origem: ${s.page_url}` : null,
        payload: { session_id: s.id, page_url: s.page_url },
        status: "new",
      })
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);

    const leadId = (lead as { id: string }).id;
    await context.supabase.from("site_chat_sessions").update({ lead_id: leadId }).eq("id", s.id);
    return { ok: true, lead_id: leadId };
  });
