import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cidades silenciosas — onde temos clientes (snapshot Customer 360)
 * mas atividade comercial parou. Mostra contagens para 30/60/90 dias.
 *
 * Lê customer_360_snapshot + companies (city/state) na própria org via RLS.
 */
export const listSilentCities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Snapshots da org, com last_activity_at (pode ser NULL)
    const { data: snaps, error } = await supabase
      .from("customer_360_snapshot")
      .select("company_id, last_activity_at, monetary")
      .eq("organization_id", data.organization_id)
      .not("company_id", "is", null)
      .limit(5000);
    if (error) throw new Error(error.message);

    const companyIds = Array.from(
      new Set((snaps ?? []).map((s) => s.company_id).filter(Boolean) as string[]),
    );
    if (!companyIds.length) {
      return { rows: [] as Array<{ city: string; state: string | null; total: number; silent_30: number; silent_60: number; silent_90: number; potential: number }> };
    }

    const { data: comps, error: cErr } = await supabase
      .from("companies")
      .select("id, city, state")
      .in("id", companyIds);
    if (cErr) throw new Error(cErr.message);

    const cityOf = new Map<string, { city: string; state: string | null }>();
    for (const c of comps ?? []) {
      if (c.city) cityOf.set(c.id, { city: c.city, state: c.state ?? null });
    }

    const now = Date.now();
    const d30 = now - 30 * 86400_000;
    const d60 = now - 60 * 86400_000;
    const d90 = now - 90 * 86400_000;

    const agg = new Map<
      string,
      { city: string; state: string | null; total: number; silent_30: number; silent_60: number; silent_90: number; potential: number }
    >();

    for (const s of snaps ?? []) {
      const loc = cityOf.get(s.company_id as string);
      if (!loc) continue;
      const key = `${loc.city}||${loc.state ?? ""}`;
      const row =
        agg.get(key) ??
        { city: loc.city, state: loc.state, total: 0, silent_30: 0, silent_60: 0, silent_90: 0, potential: 0 };
      row.total += 1;
      row.potential += Number(s.monetary ?? 0);
      const t = s.last_activity_at ? new Date(s.last_activity_at).getTime() : 0;
      if (!t || t < d30) row.silent_30 += 1;
      if (!t || t < d60) row.silent_60 += 1;
      if (!t || t < d90) row.silent_90 += 1;
      agg.set(key, row);
    }

    const rows = Array.from(agg.values())
      .filter((r) => r.silent_60 > 0)
      .sort((a, b) => b.silent_60 - a.silent_60 || b.potential - a.potential)
      .slice(0, data.limit);

    return { rows };
  });
