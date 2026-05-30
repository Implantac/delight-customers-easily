import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// =============================================================================
// Leads Inbox — caixa de entrada unificada de leads.
// Junta submissões de formulários (lead_form_submissions) e contatos novos
// sem deal ainda, expondo origem, score básico e estado (novo / contatado /
// convertido / descartado), para o vendedor agir direto.
// =============================================================================

const Input = z.object({
  organization_id: z.string().uuid(),
  status: z.enum(["all", "new", "contacted", "converted", "discarded"]).default("all"),
  source: z.string().optional(),
  limit: z.number().int().min(10).max(500).default(200),
});

export type LeadInboxItem = {
  id: string;
  kind: "form_submission" | "contact";
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  form_name: string | null;
  contact_id: string | null;
  deal_id: string | null;
  status: "new" | "contacted" | "converted" | "discarded";
  created_at: string;
  payload: any;
};

export const getLeadsInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const [subsRes, formsRes, contactsRes, dealsRes, actsRes] = await Promise.all([
      supabase
        .from("lead_form_submissions")
        .select("id, form_id, name, email, phone, contact_id, deal_id, payload, created_at")
        .order("created_at", { ascending: false })
        .limit(400),
      supabase.from("lead_forms").select("id, name, slug, default_source").eq("organization_id", org),
      supabase
        .from("contacts")
        .select("id, name, email, phone, created_at")
        .eq("organization_id", org)
        .order("created_at", { ascending: false })
        .limit(400),
      supabase.from("deals").select("id, contact_id, stage").eq("organization_id", org),
      supabase
        .from("activities")
        .select("contact_id, created_at")
        .eq("organization_id", org)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    const formById = new Map<string, any>();
    for (const f of formsRes.data ?? []) formById.set(f.id, f);

    // submissions só do tenant (via formId)
    const submissions = (subsRes.data ?? []).filter((s: any) => formById.has(s.form_id));

    const dealsByContact = new Map<string, any[]>();
    for (const d of dealsRes.data ?? []) {
      if (!d.contact_id) continue;
      const arr = dealsByContact.get(d.contact_id) ?? [];
      arr.push(d);
      dealsByContact.set(d.contact_id, arr);
    }
    const lastActByContact = new Map<string, string>();
    for (const a of actsRes.data ?? []) {
      if (!a.contact_id) continue;
      if (!lastActByContact.has(a.contact_id)) lastActByContact.set(a.contact_id, a.created_at);
    }

    const items: LeadInboxItem[] = [];

    for (const s of submissions as any[]) {
      const form = formById.get(s.form_id);
      const hasDeal = !!s.deal_id;
      const contacted = s.contact_id && lastActByContact.has(s.contact_id);
      const status: LeadInboxItem["status"] = hasDeal
        ? "converted"
        : contacted
          ? "contacted"
          : "new";
      items.push({
        id: `sub:${s.id}`,
        kind: "form_submission",
        name: s.name ?? s.email ?? "Lead anônimo",
        email: s.email,
        phone: s.phone,
        source: form?.default_source ?? "form",
        form_name: form?.name ?? null,
        contact_id: s.contact_id,
        deal_id: s.deal_id,
        status,
        created_at: s.created_at,
        payload: s.payload ?? null,
      });
    }

    // contatos sem deal e sem submission associada
    const subContactIds = new Set(submissions.map((s: any) => s.contact_id).filter(Boolean));
    for (const c of (contactsRes.data ?? []) as any[]) {
      if (subContactIds.has(c.id)) continue;
      const deals = dealsByContact.get(c.id) ?? [];
      const open = deals.find((d: any) => d.stage !== "won" && d.stage !== "lost");
      const won = deals.find((d: any) => d.stage === "won");
      const contacted = lastActByContact.has(c.id);
      // ignora contatos antigos já trabalhados — foco é "lead novo"
      if (deals.length > 0 && !open) continue; // perdido/ganho antigo
      const status: LeadInboxItem["status"] = won ? "converted" : open ? "converted" : contacted ? "contacted" : "new";
      items.push({
        id: `contact:${c.id}`,
        kind: "contact",
        name: c.name,
        email: c.email,
        phone: c.phone,
        source: null,
        form_name: null,
        contact_id: c.id,
        deal_id: open?.id ?? null,
        status,
        created_at: c.created_at,
        payload: null,
      });
    }

    items.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const filtered = items.filter((it) => {
      if (data.status !== "all" && it.status !== data.status) return false;
      if (data.source && (it.source ?? "").toLowerCase() !== data.source.toLowerCase()) return false;
      return true;
    });

    const summary = {
      total: items.length,
      new: items.filter((i) => i.status === "new").length,
      contacted: items.filter((i) => i.status === "contacted").length,
      converted: items.filter((i) => i.status === "converted").length,
      discarded: items.filter((i) => i.status === "discarded").length,
      sources: Array.from(
        items.reduce((m, i) => {
          const k = (i.source ?? "—").toLowerCase();
          m.set(k, (m.get(k) ?? 0) + 1);
          return m;
        }, new Map<string, number>()),
      ).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    };

    return { items: filtered.slice(0, data.limit), summary };
  });

const ConvertInput = z.object({
  organization_id: z.string().uuid(),
  item_id: z.string(),
  deal_title: z.string().min(1).max(255),
  deal_value: z.number().min(0).default(0),
});

export const convertLeadToDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ConvertInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [kind, rawId] = data.item_id.split(":");
    let contactId: string | null = null;

    if (kind === "sub") {
      const { data: sub } = await supabase
        .from("lead_form_submissions")
        .select("id, contact_id, email, name, phone, form_id")
        .eq("id", rawId)
        .maybeSingle();
      if (!sub) throw new Error("Submissão não encontrada");
      contactId = sub.contact_id;
      if (!contactId) {
        const { data: c, error } = await supabase
          .from("contacts")
          .insert({
            organization_id: data.organization_id,
            name: sub.name ?? sub.email ?? "Lead",
            email: sub.email,
            phone: sub.phone,
            user_id: userId,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        contactId = c.id;
        await supabase.from("lead_form_submissions").update({ contact_id: contactId }).eq("id", rawId);
      }
    } else if (kind === "contact") {
      contactId = rawId;
    } else {
      throw new Error("Tipo inválido");
    }

    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .insert({
        organization_id: data.organization_id,
        title: data.deal_title,
        value: data.deal_value,
        stage: "lead",
        contact_id: contactId,
        user_id: userId,
      })
      .select("id")
      .single();
    if (dealErr) throw new Error(dealErr.message);

    if (kind === "sub") {
      await supabase.from("lead_form_submissions").update({ deal_id: deal.id }).eq("id", rawId);
    }

    return { deal_id: deal.id, contact_id: contactId };
  });

const DiscardInput = z.object({
  organization_id: z.string().uuid(),
  item_id: z.string(),
});

export const discardLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => DiscardInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [kind, rawId] = data.item_id.split(":");
    if (kind === "sub") {
      const { error } = await supabase
        .from("lead_form_submissions")
        .delete()
        .eq("id", rawId);
      if (error) throw new Error(error.message);
    } else {
      throw new Error("Apenas submissões de formulário podem ser descartadas.");
    }
    return { ok: true };
  });
