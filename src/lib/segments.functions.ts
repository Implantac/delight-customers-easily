import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  organization_id: z.string().uuid(),
});

export type Segment =
  | "champions"
  | "loyal"
  | "potential"
  | "new"
  | "at_risk"
  | "hibernating"
  | "lost";

export type RFMRow = {
  company_id: string;
  name: string;
  industry: string | null;
  recencyDays: number;
  frequency: number;
  monetary: number;
  rScore: 1 | 2 | 3 | 4 | 5;
  fScore: 1 | 2 | 3 | 4 | 5;
  mScore: 1 | 2 | 3 | 4 | 5;
  segment: Segment;
  action: string;
};

const SEGMENT_LABEL: Record<Segment, string> = {
  champions: "Campeões",
  loyal: "Fiéis",
  potential: "Potencial",
  new: "Novos",
  at_risk: "Em risco",
  hibernating: "Hibernando",
  lost: "Perdidos",
};

const SEGMENT_ACTION: Record<Segment, string> = {
  champions: "Programa de fidelidade · upsell premium",
  loyal: "Cross-sell · pedir indicações",
  potential: "Oferta personalizada para subir frequência",
  new: "Onboarding · primeira compra reforçada",
  at_risk: "Reativação urgente · oferta de retenção",
  hibernating: "Campanha de reengajamento",
  lost: "Win-back ou descartar do CRM",
};

function quintile(value: number, sortedAsc: number[]): 1 | 2 | 3 | 4 | 5 {
  if (sortedAsc.length === 0) return 3;
  const idx = sortedAsc.findIndex((v) => value <= v);
  const pos = idx === -1 ? sortedAsc.length - 1 : idx;
  const q = pos / Math.max(1, sortedAsc.length - 1);
  if (q <= 0.2) return 1;
  if (q <= 0.4) return 2;
  if (q <= 0.6) return 3;
  if (q <= 0.8) return 4;
  return 5;
}

function classify(r: number, f: number, m: number): Segment {
  if (r >= 4 && f >= 4 && m >= 4) return "champions";
  if (r >= 3 && f >= 4) return "loyal";
  if (r >= 4 && f <= 2) return "new";
  if (r >= 3 && m >= 4) return "potential";
  if (r <= 2 && f >= 3) return "at_risk";
  if (r <= 2 && m >= 4) return "at_risk";
  if (r === 1 && f === 1 && m === 1) return "lost";
  return "hibernating";
}

export const getSegments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [companiesRes, dealsRes] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, industry")
        .eq("organization_id", data.organization_id)
        .limit(2000),
      supabase
        .from("deals")
        .select("company_id, value, stage, closed_at, created_at, updated_at")
        .eq("organization_id", data.organization_id)
        .limit(5000),
    ]);

    const companies = (companiesRes.data ?? []) as Array<{
      id: string; name: string; industry: string | null;
    }>;
    const deals = (dealsRes.data ?? []) as Array<{
      company_id: string | null; value: number | null; stage: string;
      closed_at: string | null; created_at: string; updated_at: string;
    }>;

    const now = Date.now();
    type Agg = { freq: number; monetary: number; lastAt: number };
    const byCompany = new Map<string, Agg>();
    for (const d of deals) {
      if (!d.company_id) continue;
      if (d.stage !== "won") continue;
      const value = Number(d.value ?? 0);
      const ts = new Date(d.closed_at ?? d.updated_at).getTime();
      const cur = byCompany.get(d.company_id) ?? { freq: 0, monetary: 0, lastAt: 0 };
      cur.freq += 1;
      cur.monetary += value;
      cur.lastAt = Math.max(cur.lastAt, ts);
      byCompany.set(d.company_id, cur);
    }

    const rows: RFMRow[] = [];
    const recencyVals: number[] = [];
    const freqVals: number[] = [];
    const monVals: number[] = [];

    for (const c of companies) {
      const a = byCompany.get(c.id);
      if (!a || a.freq === 0) continue;
      const recencyDays = Math.max(0, Math.floor((now - a.lastAt) / 86400_000));
      recencyVals.push(-recencyDays); // higher = better
      freqVals.push(a.freq);
      monVals.push(a.monetary);
      rows.push({
        company_id: c.id,
        name: c.name,
        industry: c.industry,
        recencyDays,
        frequency: a.freq,
        monetary: a.monetary,
        rScore: 3, fScore: 3, mScore: 3,
        segment: "potential",
        action: "",
      });
    }

    const rSorted = [...recencyVals].sort((a, b) => a - b);
    const fSorted = [...freqVals].sort((a, b) => a - b);
    const mSorted = [...monVals].sort((a, b) => a - b);

    for (const row of rows) {
      row.rScore = quintile(-row.recencyDays, rSorted);
      row.fScore = quintile(row.frequency, fSorted);
      row.mScore = quintile(row.monetary, mSorted);
      row.segment = classify(row.rScore, row.fScore, row.mScore);
      row.action = SEGMENT_ACTION[row.segment];
    }

    rows.sort((a, b) => b.monetary - a.monetary);

    const summary = (Object.keys(SEGMENT_LABEL) as Segment[]).map((seg) => {
      const items = rows.filter((r) => r.segment === seg);
      return {
        segment: seg,
        label: SEGMENT_LABEL[seg],
        action: SEGMENT_ACTION[seg],
        count: items.length,
        revenue: items.reduce((s, r) => s + r.monetary, 0),
      };
    });

    return { rows, summary, total: rows.length };
  });
