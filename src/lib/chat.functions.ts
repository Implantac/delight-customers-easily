import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });

export type ConversationRow = {
  id: string;
  title: string | null;
  kind: "direct" | "group";
  last_message_at: string;
  participants: Array<{ user_id: string; full_name: string | null; last_read_at: string | null }>;
  last_message: { body: string; sender_id: string; created_at: string } | null;
  unread: number;
};

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = data.organization_id;

    // conversations I'm in
    const { data: myParts, error: pErr } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId)
      .eq("organization_id", org);
    if (pErr) throw new Error(pErr.message);
    const ids = (myParts ?? []).map((p) => p.conversation_id);
    if (ids.length === 0) return [] as ConversationRow[];

    const [convsRes, allPartsRes, lastMsgsRes] = await Promise.all([
      supabase.from("conversations").select("id, title, kind, last_message_at").in("id", ids).order("last_message_at", { ascending: false }),
      supabase.from("conversation_participants").select("conversation_id, user_id, last_read_at").in("conversation_id", ids),
      supabase.from("messages").select("id, conversation_id, sender_id, body, created_at").in("conversation_id", ids).order("created_at", { ascending: false }),
    ]);
    if (convsRes.error) throw new Error(convsRes.error.message);

    const partyByConv = new Map<string, { user_id: string; last_read_at: string | null }[]>();
    for (const p of allPartsRes.data ?? []) {
      const arr = partyByConv.get(p.conversation_id) ?? [];
      arr.push({ user_id: p.user_id, last_read_at: p.last_read_at });
      partyByConv.set(p.conversation_id, arr);
    }

    const allUserIds = Array.from(new Set((allPartsRes.data ?? []).map((p) => p.user_id)));
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", allUserIds.length ? allUserIds : ["00000000-0000-0000-0000-000000000000"]);
    const profMap = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string | null]));

    const lastByConv = new Map<string, any>();
    for (const m of lastMsgsRes.data ?? []) {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m);
    }
    const myReadByConv = new Map((myParts ?? []).map((p) => [p.conversation_id, p.last_read_at]));

    const rows: ConversationRow[] = (convsRes.data ?? []).map((c) => {
      const parts = (partyByConv.get(c.id) ?? []).map((p) => ({
        user_id: p.user_id, full_name: profMap.get(p.user_id) ?? null, last_read_at: p.last_read_at,
      }));
      const last = lastByConv.get(c.id) ?? null;
      const myRead = myReadByConv.get(c.id);
      const unread = (lastMsgsRes.data ?? []).filter(
        (m) => m.conversation_id === c.id && m.sender_id !== userId && (!myRead || m.created_at > myRead),
      ).length;
      return {
        id: c.id, title: c.title, kind: c.kind as any, last_message_at: c.last_message_at,
        participants: parts,
        last_message: last ? { body: last.body, sender_id: last.sender_id, created_at: last.created_at } : null,
        unread,
      };
    });
    return rows;
  });

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id, sender_id, body, attachment_url, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    // mark as read
    await supabase.from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversation_id).eq("user_id", userId);
    return msgs ?? [];
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    conversation_id: z.string().uuid(),
    organization_id: z.string().uuid(),
    body: z.string().min(1).max(4000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("messages").insert({
      conversation_id: data.conversation_id,
      organization_id: data.organization_id,
      sender_id: userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOrgMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ms, error } = await supabase
      .from("memberships")
      .select("user_id, role, profiles(id, full_name)")
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return (ms ?? [])
      .filter((m: any) => m.user_id !== userId)
      .map((m: any) => ({ user_id: m.user_id, full_name: m.profiles?.full_name ?? null, role: m.role }));
  });

export const startDirectConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    organization_id: z.string().uuid(),
    other_user_id: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.other_user_id === userId) throw new Error("Conversa inválida");

    // try to find existing direct conv
    const { data: mine } = await supabase
      .from("conversation_participants")
      .select("conversation_id, conversations!inner(kind, organization_id)")
      .eq("user_id", userId)
      .eq("organization_id", data.organization_id);
    const myIds = (mine ?? []).filter((r: any) => r.conversations?.kind === "direct").map((r: any) => r.conversation_id);
    if (myIds.length > 0) {
      const { data: theirs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .in("conversation_id", myIds)
        .eq("user_id", data.other_user_id);
      if (theirs && theirs.length > 0) return { id: theirs[0].conversation_id as string };
    }

    const { data: conv, error: cErr } = await supabase
      .from("conversations")
      .insert({ organization_id: data.organization_id, kind: "direct", created_by: userId })
      .select("id").single();
    if (cErr) throw new Error(cErr.message);
    const cid = conv!.id as string;
    const { error: pErr } = await supabase.from("conversation_participants").insert([
      { conversation_id: cid, user_id: userId, organization_id: data.organization_id },
      { conversation_id: cid, user_id: data.other_user_id, organization_id: data.organization_id },
    ]);
    if (pErr) throw new Error(pErr.message);
    return { id: cid };
  });
