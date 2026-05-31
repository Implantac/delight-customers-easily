import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Contract = {
  id: string;
  organization_id: string;
  number: string;
  title: string;
  description: string | null;
  type: "sale" | "nda" | "msa" | "sow" | "renewal" | "partnership" | "other";
  status: "draft" | "sent" | "active" | "expiring" | "ended" | "cancelled";
  company_id: string | null;
  contact_id: string | null;
  deal_id: string | null;
  owner_id: string | null;
  amount: number | null;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  signed_at: string | null;
  renewal_alert_days: number;
  auto_renew: boolean;
  document_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ContractEvent = {
  id: string;
  organization_id: string;
  contract_id: string;
  event_type: "created" | "sent" | "signed" | "amended" | "renewed" | "cancelled" | "ended" | "note";
  description: string | null;
  created_by: string;
  created_at: string;
};

export const listContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        status: z.enum(["all", "draft", "sent", "active", "expiring", "ended", "cancelled"]).default("all"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("contracts")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Contract[];
    const now = Date.now();
    const totals = { active: 0, expiring: 0, draft: 0, ended: 0, totalValue: 0, expiringValue: 0 };
    for (const c of list) {
      const v = Number(c.amount) || 0;
      if (c.status === "active") { totals.active++; totals.totalValue += v; }
      if (c.status === "expiring") { totals.expiring++; totals.expiringValue += v; }
      if (c.status === "draft" || c.status === "sent") totals.draft++;
      if (c.status === "ended" || c.status === "cancelled") totals.ended++;
      if (c.status === "active" && c.end_date) {
        const days = (new Date(c.end_date).getTime() - now) / 86400000;
        if (days <= (c.renewal_alert_days ?? 30) && days >= 0) {
          totals.expiring++;
          totals.expiringValue += v;
        }
      }
    }
    return { contracts: list, totals };
  });

export const getContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().uuid(), organization_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: c, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", data.id)
      .eq("organization_id", data.organization_id)
      .single();
    if (error) throw new Error(error.message);
    const { data: events } = await supabase
      .from("contract_events")
      .select("*")
      .eq("contract_id", data.id)
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    return { contract: c as Contract, events: (events ?? []) as ContractEvent[] };
  });

export const upsertContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organization_id: z.string().uuid(),
        number: z.string().min(1).max(80),
        title: z.string().min(1).max(300),
        description: z.string().max(4000).nullable().optional(),
        type: z.enum(["sale", "nda", "msa", "sow", "renewal", "partnership", "other"]),
        status: z.enum(["draft", "sent", "active", "expiring", "ended", "cancelled"]),
        company_id: z.string().uuid().nullable().optional(),
        contact_id: z.string().uuid().nullable().optional(),
        deal_id: z.string().uuid().nullable().optional(),
        owner_id: z.string().uuid().nullable().optional(),
        amount: z.number().min(0).max(1e12).nullable().optional(),
        currency: z.string().max(8),
        start_date: z.string().nullable().optional(),
        end_date: z.string().nullable().optional(),
        signed_at: z.string().nullable().optional(),
        renewal_alert_days: z.number().int().min(0).max(365),
        auto_renew: z.boolean(),
        document_url: z.string().url().max(1000).nullable().optional(),
        notes: z.string().max(4000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = { ...data };
    const isNew = !payload.id;
    if (isNew) payload.created_by = userId;
    const { data: row, error } = await supabase
      .from("contracts")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (isNew) {
      await supabase.from("contract_events").insert({
        organization_id: data.organization_id,
        contract_id: row.id,
        event_type: "created",
        description: `Contrato ${row.number} criado`,
        created_by: userId,
      });
    }
    return row;
  });

export const addContractEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        contract_id: z.string().uuid(),
        event_type: z.enum(["sent", "signed", "amended", "renewed", "cancelled", "ended", "note"]),
        description: z.string().max(2000).nullable().optional(),
        update_status: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("contract_events").insert({
      organization_id: data.organization_id,
      contract_id: data.contract_id,
      event_type: data.event_type,
      description: data.description ?? null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);

    if (data.update_status) {
      const map: Record<string, string | undefined> = {
        sent: "sent", signed: "active", cancelled: "cancelled", ended: "ended", renewed: "active",
      };
      const newStatus = map[data.event_type];
      if (newStatus) {
        const patch: any = { status: newStatus };
        if (data.event_type === "signed") patch.signed_at = new Date().toISOString();
        await supabase.from("contracts").update(patch).eq("id", data.contract_id);
      }
    }
    return { ok: true };
  });

export const deleteContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contracts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
