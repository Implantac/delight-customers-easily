import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Sequence = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
};

export type SequenceStep = {
  id: string;
  sequence_id: string;
  step_order: number;
  day_offset: number;
  type: "call" | "email" | "task" | "meeting" | "note";
  subject: string;
  body: string | null;
};

export type SequenceEnrollment = {
  id: string;
  sequence_id: string;
  contact_id: string;
  status: "active" | "completed" | "paused" | "cancelled";
  enrolled_at: string;
  completed_at: string | null;
  paused_reason?: string | null;
  paused_at?: string | null;
  contacts?: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;

  sequences?: { id: string; name: string } | null;
};

export const listSequences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("sequences")
      .select("id, name, description, active, created_at")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    let stepCounts: Record<string, number> = {};
    let enrollCounts: Record<string, number> = {};
    if (ids.length) {
      const [{ data: steps }, { data: enrolls }] = await Promise.all([
        supabase.from("sequence_steps").select("sequence_id").in("sequence_id", ids),
        supabase
          .from("sequence_enrollments")
          .select("sequence_id, status")
          .in("sequence_id", ids)
          .eq("status", "active"),
      ]);
      (steps ?? []).forEach((s: any) => {
        stepCounts[s.sequence_id] = (stepCounts[s.sequence_id] ?? 0) + 1;
      });
      (enrolls ?? []).forEach((e: any) => {
        enrollCounts[e.sequence_id] = (enrollCounts[e.sequence_id] ?? 0) + 1;
      });
    }

    return {
      sequences: (rows ?? []).map((r) => ({
        ...r,
        step_count: stepCounts[r.id] ?? 0,
        active_enrollments: enrollCounts[r.id] ?? 0,
      })) as (Sequence & { step_count: number; active_enrollments: number })[],
    };
  });

export const getSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: seq, error } = await supabase
      .from("sequences")
      .select("id, organization_id, name, description, active, created_at")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const [{ data: steps }, { data: enrollments }] = await Promise.all([
      supabase
        .from("sequence_steps")
        .select("id, sequence_id, step_order, day_offset, type, subject, body")
        .eq("sequence_id", data.id)
        .order("step_order", { ascending: true }),
      supabase
        .from("sequence_enrollments")
        .select("id, sequence_id, contact_id, status, enrolled_at, completed_at, paused_reason, paused_at")
        .eq("sequence_id", data.id)
        .order("enrolled_at", { ascending: false })
        .limit(200),
    ]);

    const contactIds = Array.from(new Set((enrollments ?? []).map((e: any) => e.contact_id)));
    let contactsById: Record<string, any> = {};
    if (contactIds.length) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .in("id", contactIds);
      (contacts ?? []).forEach((c: any) => {
        contactsById[c.id] = c;
      });
    }

    return {
      sequence: seq,
      steps: (steps ?? []) as SequenceStep[],
      enrollments: (enrollments ?? []).map((e: any) => ({
        ...e,
        contacts: contactsById[e.contact_id] ?? null,
      })) as SequenceEnrollment[],
    };
  });

export const upsertSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organization_id: z.string().uuid(),
        name: z.string().min(1).max(160),
        description: z.string().max(2000).nullable().optional(),
        active: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("sequences")
        .update({
          name: data.name,
          description: data.description ?? null,
          active: data.active,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("sequences")
      .insert({
        organization_id: data.organization_id,
        name: data.name,
        description: data.description ?? null,
        active: data.active,
        created_by: userId!,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("sequences").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        sequence_id: z.string().uuid(),
        organization_id: z.string().uuid(),
        step_order: z.number().int().min(1).max(100),
        day_offset: z.number().int().min(0).max(365),
        type: z.enum(["call", "email", "task", "meeting", "note"]),
        subject: z.string().min(1).max(255),
        body: z.string().max(5000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.id) {
      const { error } = await supabase
        .from("sequence_steps")
        .update({
          step_order: data.step_order,
          day_offset: data.day_offset,
          type: data.type,
          subject: data.subject,
          body: data.body ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabase.from("sequence_steps").insert({
      sequence_id: data.sequence_id,
      organization_id: data.organization_id,
      step_order: data.step_order,
      day_offset: data.day_offset,
      type: data.type,
      subject: data.subject,
      body: data.body ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("sequence_steps").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const enrollContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        sequence_id: z.string().uuid(),
        contact_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: steps, error: stepsErr } = await supabase
      .from("sequence_steps")
      .select("day_offset, type, subject, body")
      .eq("sequence_id", data.sequence_id)
      .order("step_order", { ascending: true });
    if (stepsErr) throw new Error(stepsErr.message);
    if (!steps || steps.length === 0) throw new Error("Sequência sem passos definidos");

    const { error: enrollErr } = await supabase.from("sequence_enrollments").insert({
      organization_id: data.organization_id,
      sequence_id: data.sequence_id,
      contact_id: data.contact_id,
      enrolled_by: userId!,
    });
    if (enrollErr) throw new Error(enrollErr.message);

    const today = new Date();
    const rows = steps.map((s: any) => {
      const due = new Date(today);
      due.setDate(today.getDate() + s.day_offset);
      return {
        organization_id: data.organization_id,
        user_id: userId!,
        contact_id: data.contact_id,
        type: s.type,
        title: s.subject,
        description: s.body,
        due_date: due.toISOString().slice(0, 10),
        completed: false,
      };
    });
    const { error: actErr } = await supabase.from("activities").insert(rows);
    if (actErr) throw new Error(actErr.message);

    return { ok: true, created: rows.length };
  });

export const updateEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["active", "completed", "paused", "cancelled"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = { status: data.status };
    if (data.status === "completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("sequence_enrollments").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Lista matrículas pausadas automaticamente por resposta (WhatsApp/e-mail) — inbox de follow-up manual. */
export const listPausedByReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ organization_id: z.string().uuid(), limit: z.number().int().min(1).max(100).default(30) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await (supabase as any)
      .from("sequence_enrollments")
      .select("id, sequence_id, contact_id, status, paused_reason, paused_at")
      .eq("organization_id", data.organization_id)
      .eq("status", "paused")
      .not("paused_reason", "is", null)
      .order("paused_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    if (list.length === 0) return { items: [] };

    const contactIds = Array.from(new Set(list.map((r) => r.contact_id)));
    const seqIds = Array.from(new Set(list.map((r) => r.sequence_id)));
    const [{ data: contacts }, { data: seqs }] = await Promise.all([
      supabase.from("contacts").select("id, first_name, last_name, email, phone").in("id", contactIds),
      supabase.from("sequences").select("id, name").in("id", seqIds),
    ]);
    const cMap = new Map((contacts ?? []).map((c: any) => [c.id, c]));
    const sMap = new Map((seqs ?? []).map((s: any) => [s.id, s]));
    return {
      items: list.map((r) => ({
        ...r,
        contact: cMap.get(r.contact_id) ?? null,
        sequence: sMap.get(r.sequence_id) ?? null,
      })),
    };
  });

