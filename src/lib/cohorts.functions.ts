import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  organization_id: z.string().uuid(),
  months: z.number().int().min(3).max(24).default(12),
});

export type CohortCell = {
  cohort: string;       // YYYY-MM (first deal)
  offset: number;       // months since cohort
  companies: number;
  retained: number;     // companies that purchased again in this offset month
  revenue: number;
};

export type CohortRow = {
  cohort: string;
  size: number;
  totalRevenue: number;
  cells: Record<number, CohortCell>;
};

function ym(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function diffMonths(a: string, b: string) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export const getCohorts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - data.months);
    since.setUTCDate(1);

    const { data: deals, error } = await supabase
      .from("deals")
      .select("company_id, value, closed_at, updated_at, stage")
      .eq("organization_id", data.organization_id)
      .eq("stage", "won")
      .gte("updated_at", since.toISOString())
      .limit(10_000);
    if (error) throw new Error(error.message);

    // Group by company
    type Won = { date: Date; value: number };
    const byCompany = new Map<string, Won[]>();
    for (const d of (deals ?? []) as any[]) {
      if (!d.company_id) continue;
      const date = new Date(d.closed_at ?? d.updated_at);
      const arr = byCompany.get(d.company_id) ?? [];
      arr.push({ date, value: Number(d.value ?? 0) });
      byCompany.set(d.company_id, arr);
    }

    // Build cohort grid
    const rowsMap = new Map<string, CohortRow>();
    const maxOffset = data.months;

    for (const wins of byCompany.values()) {
      wins.sort((a, b) => a.date.getTime() - b.date.getTime());
      const cohort = ym(wins[0].date);
      let row = rowsMap.get(cohort);
      if (!row) {
        row = { cohort, size: 0, totalRevenue: 0, cells: {} };
        rowsMap.set(cohort, row);
      }
      row.size += 1;
      // Mark which offset months had a purchase
      const seen = new Set<number>();
      for (const w of wins) {
        const off = diffMonths(cohort, ym(w.date));
        if (off < 0 || off > maxOffset) continue;
        const cell = row.cells[off] ?? { cohort, offset: off, companies: row.size, retained: 0, revenue: 0 };
        cell.revenue += w.value;
        row.totalRevenue += w.value;
        if (!seen.has(off)) {
          seen.add(off);
          cell.retained += 1;
        }
        row.cells[off] = cell;
      }
    }

    const rows = Array.from(rowsMap.values()).sort((a, b) => a.cohort.localeCompare(b.cohort));
    // Fix cell.companies (cohort size) to be the same per row
    for (const r of rows) {
      for (const off of Object.keys(r.cells)) {
        r.cells[Number(off)].companies = r.size;
      }
    }

    const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);
    return { rows, offsets, totalCompanies: byCompany.size };
  });
