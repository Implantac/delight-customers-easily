import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Provider = z.enum(["omie", "bling", "custom"]);
const Entity = z.enum(["contacts", "companies", "products", "orders"]);

export const listFieldMappings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    organization_id: z.string().uuid(),
    provider: Provider.optional(),
    entity: Entity.optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("erp_field_mappings")
      .select("id,provider,entity,source_field,target_field,transform,updated_at")
      .eq("organization_id", data.organization_id)
      .order("provider").order("entity").order("source_field");
    if (data.provider) q = q.eq("provider", data.provider);
    if (data.entity) q = q.eq("entity", data.entity);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { mappings: rows ?? [] };
  });

export const upsertFieldMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    organization_id: z.string().uuid(),
    provider: Provider,
    entity: Entity,
    source_field: z.string().min(1).max(100),
    target_field: z.string().min(1).max(100),
    transform: z.enum(["none","trim","uppercase","lowercase","digits_only","cnpj_mask"]).default("none"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("erp_field_mappings")
      .upsert({
        organization_id: data.organization_id,
        provider: data.provider,
        entity: data.entity,
        source_field: data.source_field,
        target_field: data.target_field,
        transform: data.transform,
      }, { onConflict: "organization_id,provider,entity,source_field" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFieldMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("erp_field_mappings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInboundLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    organization_id: z.string().uuid(),
    limit: z.number().int().min(1).max(200).default(50),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("erp_inbound_log")
      .select("id,provider,entity,external_id,status,error,created_at")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { events: rows ?? [] };
  });
