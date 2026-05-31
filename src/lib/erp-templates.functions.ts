import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAPPING_TEMPLATES, listTemplateKeys, type TemplateKey } from "./erp-mapping-templates";

export const listMappingTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      templates: listTemplateKeys().map((k) => ({
        key: k,
        label: k === "protheus" ? "TOTVS Protheus" : k.charAt(0).toUpperCase() + k.slice(1),
        count: MAPPING_TEMPLATES[k].length,
        entities: Array.from(new Set(MAPPING_TEMPLATES[k].map((m) => m.entity))),
      })),
    };
  });

export const applyMappingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      template: z.enum(["omie", "tiny", "protheus"]),
      overwrite: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const key = data.template as TemplateKey;
    const rows = MAPPING_TEMPLATES[key].map((m) => ({
      organization_id: data.organization_id,
      provider: m.provider,
      entity: m.entity,
      source_field: m.source_field,
      target_field: m.target_field,
      transform: m.transform,
    }));

    if (data.overwrite) {
      // Limpa os mapeamentos atuais do provider envolvido neste template
      const providers = Array.from(new Set(rows.map((r) => r.provider)));
      for (const p of providers) {
        await context.supabase
          .from("erp_field_mappings")
          .delete()
          .eq("organization_id", data.organization_id)
          .eq("provider", p);
      }
    }

    const { error } = await context.supabase
      .from("erp_field_mappings")
      .upsert(rows, { onConflict: "organization_id,provider,entity,source_field" });
    if (error) throw new Error(error.message);

    return { ok: true, applied: rows.length };
  });
