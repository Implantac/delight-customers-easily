import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Territory = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string | null;
  default_owner_id: string | null;
  active: boolean;
};

export type TerritoryRule = {
  id: string;
  territory_id: string;
  field: string;
  operator: string;
  value: string;
  priority: number;
};

export type TerritoryMember = {
  id: string;
  territory_id: string;
  user_id: string;
  weight: number;
};

export const listTerritories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [terrs, rules, members] = await Promise.all([
      supabase.from("territories").select("*").eq("organization_id", data.organization_id).order("name"),
      supabase.from("territory_rules").select("*").eq("organization_id", data.organization_id).order("priority", { ascending: false }),
      supabase.from("territory_members").select("*").eq("organization_id", data.organization_id),
    ]);
    if (terrs.error) throw new Error(terrs.error.message);
    if (rules.error) throw new Error(rules.error.message);
    if (members.error) throw new Error(members.error.message);
    return {
      territories: (terrs.data ?? []) as Territory[],
      rules: (rules.data ?? []) as TerritoryRule[],
      members: (members.data ?? []) as TerritoryMember[],
    };
  });

export const upsertTerritory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organization_id: z.string().uuid(),
        name: z.string().min(1).max(120),
        description: z.string().max(1000).nullable().optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        default_owner_id: z.string().uuid().nullable().optional(),
        active: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("territories")
      .upsert(data, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTerritory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("territories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addTerritoryRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        territory_id: z.string().uuid(),
        organization_id: z.string().uuid(),
        field: z.enum(["country", "state", "city", "industry", "revenue_min", "revenue_max", "tag"]),
        operator: z.enum(["equals", "contains", "gte", "lte", "in"]).default("equals"),
        value: z.string().min(1).max(500),
        priority: z.number().int().min(0).max(1000).default(0),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("territory_rules")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTerritoryRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("territory_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addTerritoryMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        territory_id: z.string().uuid(),
        organization_id: z.string().uuid(),
        user_id: z.string().uuid(),
        weight: z.number().int().min(1).max(100).default(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("territory_members")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removeTerritoryMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("territory_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
