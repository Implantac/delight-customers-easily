/**
 * Per-company ERP sync status — usado em Customer 360 para mostrar um chip
 * indicando há quanto tempo o cliente foi sincronizado com o ERP e se há
 * conflitos abertos vinculados ao external_id desse cliente.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CompanyErpStatus = {
  company_id: string;
  synced_at: string | null;
  external_id: string | null;
  integration_id: string | null;
  provider: string | null;
  open_conflicts: number;
  last_error: string | null;
};

export const getCompanyErpStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string; company_ids: string[] }) =>
    z
      .object({
        organization_id: z.string().uuid(),
        company_ids: z.array(z.string().uuid()).min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: rows, error } = await supabase
      .from("erp_customers")
      .select("company_id,external_id,integration_id,synced_at")
      .eq("organization_id", data.organization_id)
      .in("company_id", data.company_ids);
    if (error) throw new Error(error.message);

    const integrationIds = Array.from(
      new Set((rows ?? []).map((r) => r.integration_id).filter(Boolean) as string[]),
    );

    const providerMap = new Map<string, { provider: string; last_error: string | null }>();
    if (integrationIds.length > 0) {
      const { data: ints } = await supabase
        .from("erp_integrations")
        .select("id,provider,last_error")
        .in("id", integrationIds);
      for (const i of ints ?? []) {
        providerMap.set(i.id, { provider: i.provider, last_error: i.last_error });
      }
    }

    // Conflicts open per (integration_id, external_id)
    const conflictKeyCount = new Map<string, number>();
    if (rows && rows.length > 0) {
      const extIds = Array.from(new Set(rows.map((r) => r.external_id).filter(Boolean) as string[]));
      if (extIds.length > 0 && integrationIds.length > 0) {
        const { data: confs } = await supabase
          .from("erp_sync_conflicts")
          .select("integration_id,external_id")
          .eq("organization_id", data.organization_id)
          .eq("resource", "customers")
          .in("integration_id", integrationIds)
          .in("external_id", extIds)
          .is("resolved_at", null);
        for (const c of confs ?? []) {
          const k = `${c.integration_id}::${c.external_id}`;
          conflictKeyCount.set(k, (conflictKeyCount.get(k) ?? 0) + 1);
        }
      }
    }

    // Group by company_id — keep most recent synced row
    const byCompany = new Map<string, CompanyErpStatus>();
    for (const r of rows ?? []) {
      if (!r.company_id) continue;
      const meta = r.integration_id ? providerMap.get(r.integration_id) ?? null : null;
      const key = `${r.integration_id}::${r.external_id}`;
      const conflicts = conflictKeyCount.get(key) ?? 0;
      const existing = byCompany.get(r.company_id);
      const candidate: CompanyErpStatus = {
        company_id: r.company_id,
        synced_at: r.synced_at,
        external_id: r.external_id,
        integration_id: r.integration_id,
        provider: meta?.provider ?? null,
        open_conflicts: conflicts,
        last_error: meta?.last_error ?? null,
      };
      if (
        !existing ||
        (candidate.synced_at &&
          (!existing.synced_at || candidate.synced_at > existing.synced_at))
      ) {
        // accumulate conflicts across mirrored rows for the same company
        candidate.open_conflicts = Math.max(candidate.open_conflicts, existing?.open_conflicts ?? 0);
        byCompany.set(r.company_id, candidate);
      } else if (existing) {
        existing.open_conflicts += conflicts;
      }
    }

    return { items: Array.from(byCompany.values()) };
  });
