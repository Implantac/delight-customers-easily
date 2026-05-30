import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const listInput = z.object({ organization_id: z.string().uuid() });

export const listProposals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => listInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("proposals")
      .select("id, title, status, total, valid_until, updated_at, deal_id, contact_id, company_id, companies(name), contacts(name)")
      .eq("organization_id", data.organization_id)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

const createInput = z.object({
  organization_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  deal_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  company_id: z.string().uuid().nullable().optional(),
});
export const createProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("proposals")
      .insert({
        organization_id: data.organization_id,
        title: data.title,
        deal_id: data.deal_id ?? null,
        contact_id: data.contact_id ?? null,
        company_id: data.company_id ?? null,
        created_by: userId,
      })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

const getInput = z.object({ id: z.string().uuid() });
export const getProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => getInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: p, error: pe }, { data: items, error: ie }] = await Promise.all([
      supabase.from("proposals")
        .select("*, companies(name), contacts(name, email), deals(title, value)")
        .eq("id", data.id).single(),
      supabase.from("proposal_items")
        .select("*").eq("proposal_id", data.id).order("sort_order", { ascending: true }),
    ]);
    if (pe) throw new Error(pe.message);
    if (ie) throw new Error(ie.message);
    return { proposal: p, items: items ?? [] };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
  valid_until: z.string().nullable().optional(),
  notes: z.string().max(20_000).nullable().optional(),
  discount_percent: z.number().min(0).max(100).optional(),
});
export const updateProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("proposals").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await recomputeTotals(context.supabase, id);
    return { ok: true };
  });

const deleteInput = z.object({ id: z.string().uuid() });
export const deleteProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => deleteInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("proposals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const upsertItemInput = z.object({
  id: z.string().uuid().optional(),
  proposal_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  product_id: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().min(0).max(1_000_000),
  unit_price: z.number().min(0).max(1e10),
  discount_percent: z.number().min(0).max(100).default(0),
  sort_order: z.number().int().min(0).max(10_000).default(0),
});
export const upsertItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertItemInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.id) {
      const { error } = await supabase.from("proposal_items").update({
        product_id: data.product_id ?? null, description: data.description,
        quantity: data.quantity, unit_price: data.unit_price,
        discount_percent: data.discount_percent, sort_order: data.sort_order,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("proposal_items").insert({
        proposal_id: data.proposal_id, organization_id: data.organization_id,
        product_id: data.product_id ?? null, description: data.description,
        quantity: data.quantity, unit_price: data.unit_price,
        discount_percent: data.discount_percent, sort_order: data.sort_order,
      });
      if (error) throw new Error(error.message);
    }
    await recomputeTotals(supabase, data.proposal_id);
    return { ok: true };
  });

const deleteItemInput = z.object({ id: z.string().uuid(), proposal_id: z.string().uuid() });
export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => deleteItemInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("proposal_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await recomputeTotals(context.supabase, data.proposal_id);
    return { ok: true };
  });

async function recomputeTotals(supabase: any, proposalId: string) {
  const { data: items } = await supabase
    .from("proposal_items").select("quantity, unit_price, discount_percent").eq("proposal_id", proposalId);
  const subtotal = (items ?? []).reduce((s: number, it: any) => {
    const line = Number(it.quantity) * Number(it.unit_price);
    const disc = line * (Number(it.discount_percent) / 100);
    return s + (line - disc);
  }, 0);
  const { data: prop } = await supabase
    .from("proposals").select("discount_percent").eq("id", proposalId).single();
  const propDisc = Number((prop as any)?.discount_percent ?? 0);
  const total = subtotal * (1 - propDisc / 100);
  await supabase.from("proposals").update({
    subtotal: Number(subtotal.toFixed(2)),
    total: Number(total.toFixed(2)),
  }).eq("id", proposalId);
}
