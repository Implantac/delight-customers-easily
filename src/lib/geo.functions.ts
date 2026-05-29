import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });

// Mapa de oportunidades por território.
// Sem coordenadas reais — agrupa por indústria (territorio comercial) e tamanho.
// Cada célula traz: nº de empresas, pipeline aberto, ganho, calor médio.
export const getOpportunityMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const [coRes, dealsRes] = await Promise.all([
      supabase.from("companies").select("id, name, industry, size").eq("organization_id", org),
      supabase.from("deals").select("id, company_id, stage, value").eq("organization_id", org),
    ]);

    const companies = coRes.data ?? [];
    const deals = dealsRes.data ?? [];

    const dealsByCompany = new Map<string, typeof deals>();
    for (const d of deals) {
      if (!d.company_id) continue;
      const arr = dealsByCompany.get(d.company_id) ?? [];
      arr.push(d);
      dealsByCompany.set(d.company_id, arr);
    }

    type CellKey = string;
    const cells = new Map<CellKey, {
      industry: string;
      size: string;
      companies: number;
      open_deals: number;
      open_value: number;
      won_value: number;
      lost_value: number;
      company_list: { id: string; name: string; open_value: number; won_value: number }[];
    }>();

    for (const co of companies) {
      const industry = co.industry?.trim() || "Sem setor";
      const size = co.size?.trim() || "Sem porte";
      const key = `${industry}||${size}`;

      const coDeals = dealsByCompany.get(co.id) ?? [];
      const openV = coDeals.filter((d) => d.stage !== "won" && d.stage !== "lost").reduce((s, d) => s + Number(d.value || 0), 0);
      const wonV = coDeals.filter((d) => d.stage === "won").reduce((s, d) => s + Number(d.value || 0), 0);
      const lostV = coDeals.filter((d) => d.stage === "lost").reduce((s, d) => s + Number(d.value || 0), 0);
      const openCount = coDeals.filter((d) => d.stage !== "won" && d.stage !== "lost").length;

      const cur = cells.get(key) ?? {
        industry, size,
        companies: 0, open_deals: 0,
        open_value: 0, won_value: 0, lost_value: 0,
        company_list: [],
      };
      cur.companies += 1;
      cur.open_deals += openCount;
      cur.open_value += openV;
      cur.won_value += wonV;
      cur.lost_value += lostV;
      cur.company_list.push({ id: co.id, name: co.name, open_value: openV, won_value: wonV });
      cells.set(key, cur);
    }

    const territories = [...cells.values()]
      .map((c) => ({
        ...c,
        company_list: c.company_list.sort((a, b) => b.open_value - a.open_value).slice(0, 8),
        score: c.open_value * 0.7 + c.won_value * 0.3,
      }))
      .sort((a, b) => b.score - a.score);

    const industries = new Map<string, { industry: string; companies: number; open_value: number; won_value: number }>();
    for (const t of territories) {
      const cur = industries.get(t.industry) ?? { industry: t.industry, companies: 0, open_value: 0, won_value: 0 };
      cur.companies += t.companies;
      cur.open_value += t.open_value;
      cur.won_value += t.won_value;
      industries.set(t.industry, cur);
    }

    const summary = {
      total_companies: companies.length,
      total_open_value: territories.reduce((s, t) => s + t.open_value, 0),
      total_won_value: territories.reduce((s, t) => s + t.won_value, 0),
      territories_count: territories.length,
    };

    return {
      territories,
      industries: [...industries.values()].sort((a, b) => b.open_value - a.open_value),
      summary,
    };
  });
