import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================================
// GEO PROSPECÇÃO INTELIGENTE
// Servidor: busca de prospects, empresas semelhantes, cobertura territorial e
// insights de IA — tudo escopado por organization_id via RLS.
// Foco exclusivo: prospecção comercial. Sem fiscal/estoque/financeiro.
// ============================================================================

const orgInput = z.object({ organization_id: z.string().uuid() });

type CompanyRow = {
  id: string;
  name: string;
  industry: string | null;
  size: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
};

// ---------- Prospecção Inteligente: lista candidatos (filtros visuais) -------
const SearchInput = z.object({
  organization_id: z.string().uuid(),
  industry: z.string().trim().max(100).optional(),
  segment: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(2).optional(),
  radius_km: z.number().min(1).max(2000).optional(),
  center_lat: z.number().min(-90).max(90).optional(),
  center_lng: z.number().min(-180).max(180).optional(),
  limit: z.number().min(1).max(200).default(50),
});

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const searchProspects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SearchInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Buscar todas as empresas da org; filtragem em memória para flexibilidade.
    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, name, industry, size, city, state, latitude, longitude")
      .eq("organization_id", data.organization_id)
      .limit(2000);
    if (error) throw new Error(error.message);

    // Quais já são clientes (têm deal ganho)? -> excluímos da prospecção.
    const { data: wonDeals } = await supabase
      .from("deals")
      .select("company_id")
      .eq("organization_id", data.organization_id)
      .eq("stage", "won");
    const customerSet = new Set((wonDeals ?? []).map((d) => d.company_id).filter(Boolean));

    // Score de "potencial": +20 se mesma cidade/UF de outras vendas; +20 segmento popular; +10 porte definido.
    const wonByCity = new Map<string, number>();
    const wonByIndustry = new Map<string, number>();
    const wonByCompany = new Map<string, true>();
    for (const d of wonDeals ?? []) {
      if (d.company_id) wonByCompany.set(d.company_id, true);
    }
    for (const c of (companies ?? []) as CompanyRow[]) {
      if (!wonByCompany.has(c.id)) continue;
      if (c.city) wonByCity.set(c.city, (wonByCity.get(c.city) ?? 0) + 1);
      if (c.industry) wonByIndustry.set(c.industry, (wonByIndustry.get(c.industry) ?? 0) + 1);
    }

    const norm = (s?: string | null) => (s ?? "").toLowerCase().trim();
    const fIndustry = norm(data.industry || data.segment);
    const fCity = norm(data.city);
    const fState = (data.state ?? "").toUpperCase();

    const results = ((companies ?? []) as CompanyRow[])
      .filter((c) => !customerSet.has(c.id))
      .filter((c) => !fIndustry || norm(c.industry).includes(fIndustry))
      .filter((c) => !fCity || norm(c.city).includes(fCity))
      .filter((c) => !fState || (c.state ?? "").toUpperCase() === fState)
      .map((c) => {
        let dist: number | null = null;
        if (
          typeof data.center_lat === "number" &&
          typeof data.center_lng === "number" &&
          typeof c.latitude === "number" &&
          typeof c.longitude === "number"
        ) {
          dist = distanceKm(data.center_lat, data.center_lng, c.latitude, c.longitude);
        }
        let score = 30;
        if (c.industry && wonByIndustry.has(c.industry)) score += 25;
        if (c.city && wonByCity.has(c.city)) score += 25;
        if (c.size) score += 10;
        if (c.latitude && c.longitude) score += 10;
        return {
          id: c.id,
          name: c.name,
          city: c.city,
          state: c.state,
          industry: c.industry,
          size: c.size,
          latitude: c.latitude,
          longitude: c.longitude,
          distance_km: dist,
          potential: Math.min(100, score),
        };
      })
      .filter((r) => data.radius_km == null || r.distance_km == null || r.distance_km <= data.radius_km)
      .sort((a, b) => b.potential - a.potential)
      .slice(0, data.limit);

    return { results, total: results.length };
  });

// ---------- Empresas Semelhantes --------------------------------------------
const SimilarInput = z.object({
  organization_id: z.string().uuid(),
  company_id: z.string().uuid(),
  limit: z.number().min(1).max(50).default(20),
});

export const findSimilarCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SimilarInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: source, error: srcErr } = await supabase
      .from("companies")
      .select("id, name, industry, size, city, state, latitude, longitude")
      .eq("organization_id", data.organization_id)
      .eq("id", data.company_id)
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!source) throw new Error("Empresa não encontrada.");

    const { data: pool } = await supabase
      .from("companies")
      .select("id, name, industry, size, city, state, latitude, longitude")
      .eq("organization_id", data.organization_id)
      .neq("id", data.company_id)
      .limit(2000);

    const norm = (s?: string | null) => (s ?? "").toLowerCase().trim();
    const srcInd = norm(source.industry);
    const srcCity = norm(source.city);
    const srcState = (source.state ?? "").toUpperCase();
    const srcSize = norm(source.size);

    const ranked = ((pool ?? []) as CompanyRow[])
      .map((c) => {
        let score = 0;
        if (srcInd && norm(c.industry) === srcInd) score += 40;
        else if (srcInd && norm(c.industry).split(/\s+/).some((w) => srcInd.includes(w))) score += 15;
        if (srcCity && norm(c.city) === srcCity) score += 25;
        if (srcState && (c.state ?? "").toUpperCase() === srcState) score += 15;
        if (srcSize && norm(c.size) === srcSize) score += 10;
        let dist: number | null = null;
        if (
          typeof source.latitude === "number" &&
          typeof source.longitude === "number" &&
          typeof c.latitude === "number" &&
          typeof c.longitude === "number"
        ) {
          dist = distanceKm(source.latitude, source.longitude, c.latitude, c.longitude);
          if (dist < 50) score += 10;
        }
        return {
          id: c.id,
          name: c.name,
          city: c.city,
          state: c.state,
          industry: c.industry,
          distance_km: dist,
          score: Math.min(100, score),
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, data.limit);

    return { source: { id: source.id, name: source.name }, results: ranked };
  });

// ---------- Cobertura Territorial -------------------------------------------
export const getTerritorialCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [coRes, dealsRes] = await Promise.all([
      supabase
        .from("companies")
        .select("id, city, state, industry")
        .eq("organization_id", data.organization_id)
        .limit(5000),
      supabase
        .from("deals")
        .select("company_id, stage, value")
        .eq("organization_id", data.organization_id),
    ]);
    const companies = coRes.data ?? [];
    const deals = dealsRes.data ?? [];

    const wonCompanies = new Set(
      deals.filter((d) => d.stage === "won" && d.company_id).map((d) => d.company_id as string),
    );
    const openValueByCompany = new Map<string, number>();
    for (const d of deals) {
      if (!d.company_id) continue;
      if (d.stage !== "won" && d.stage !== "lost") {
        openValueByCompany.set(
          d.company_id,
          (openValueByCompany.get(d.company_id) ?? 0) + Number(d.value || 0),
        );
      }
    }

    type Row = {
      key: string;
      city: string;
      state: string;
      total: number;
      customers: number;
      prospects: number;
      coverage: number;
      potential: number;
    };
    const map = new Map<string, Row>();
    for (const c of companies) {
      const city = (c.city ?? "Sem cidade").trim();
      const state = (c.state ?? "—").trim();
      const key = `${state}||${city}`;
      const cur = map.get(key) ?? {
        key,
        city,
        state,
        total: 0,
        customers: 0,
        prospects: 0,
        coverage: 0,
        potential: 0,
      };
      cur.total += 1;
      if (wonCompanies.has(c.id)) cur.customers += 1;
      else cur.prospects += 1;
      cur.potential += openValueByCompany.get(c.id) ?? 0;
      map.set(key, cur);
    }
    const rows = [...map.values()]
      .map((r) => ({ ...r, coverage: r.total > 0 ? Math.round((r.customers / r.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);

    return {
      rows,
      summary: {
        cities: rows.length,
        customers: rows.reduce((s, r) => s + r.customers, 0),
        prospects: rows.reduce((s, r) => s + r.prospects, 0),
      },
    };
  });

// ---------- Adicionar prospect ao CRM (cria lead) ---------------------------
const AddInput = z.object({
  organization_id: z.string().uuid(),
  company_id: z.string().uuid(),
});

export const addProspectAsLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AddInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: co, error } = await supabase
      .from("companies")
      .select("name, city, state, industry")
      .eq("organization_id", data.organization_id)
      .eq("id", data.company_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!co) throw new Error("Empresa não encontrada.");

    const { data: lead, error: insErr } = await supabase
      .from("marketing_leads")
      .insert({
        organization_id: data.organization_id,
        channel: "prospect",
        source: "geo_prospect",
        name: co.name,
        city: co.city,
        state: co.state,
        payload: { industry: co.industry, company_id: data.company_id },
        status: "new",
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { lead_id: lead.id };
  });

// ---------- IA de Prospecção -------------------------------------------------
export const getProspectingInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const key = process.env.LOVABLE_API_KEY;

    // Resumo enxuto para a IA: cobertura por cidade + pipeline.
    const [coRes, dealsRes] = await Promise.all([
      supabase
        .from("companies")
        .select("city, state, industry")
        .eq("organization_id", data.organization_id)
        .limit(5000),
      supabase
        .from("deals")
        .select("company_id, stage, value")
        .eq("organization_id", data.organization_id),
    ]);
    const companies = coRes.data ?? [];
    const deals = dealsRes.data ?? [];
    const wonSet = new Set(deals.filter((d) => d.stage === "won").map((d) => d.company_id));

    type Agg = { city: string; state: string; total: number; customers: number };
    const cityMap = new Map<string, Agg>();
    const industryMap = new Map<string, Agg>();
    for (const c of companies) {
      const cityKey = `${c.state ?? "—"}|${c.city ?? "—"}`;
      const cur = cityMap.get(cityKey) ?? { city: c.city ?? "—", state: c.state ?? "—", total: 0, customers: 0 };
      cur.total += 1;
      // o agregado de cidade não tem id; reabrimos para customers
      cityMap.set(cityKey, cur);
      const ind = c.industry ?? "Sem setor";
      const i = industryMap.get(ind) ?? { city: ind, state: "", total: 0, customers: 0 };
      i.total += 1;
      industryMap.set(ind, i);
    }
    // Customers per city/industry — segunda passada com id-aware:
    const { data: coWithId } = await supabase
      .from("companies")
      .select("id, city, state, industry")
      .eq("organization_id", data.organization_id)
      .limit(5000);
    for (const c of coWithId ?? []) {
      if (!wonSet.has(c.id)) continue;
      const cityKey = `${c.state ?? "—"}|${c.city ?? "—"}`;
      const v = cityMap.get(cityKey);
      if (v) v.customers += 1;
      const ind = c.industry ?? "Sem setor";
      const i = industryMap.get(ind);
      if (i) i.customers += 1;
    }

    const topCities = [...cityMap.values()]
      .map((r) => ({ ...r, coverage: r.total > 0 ? Math.round((r.customers / r.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
    const topIndustries = [...industryMap.values()]
      .map((r) => ({ ...r, coverage: r.total > 0 ? Math.round((r.customers / r.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    if (!key) {
      // Fallback heurístico
      const under = topCities.filter((c) => c.coverage < 20 && c.total >= 3).slice(0, 5);
      return {
        regions: under.map((c) => `${c.city}/${c.state}: ${c.coverage}% de cobertura em ${c.total} empresas`),
        actions: ["Configure LOVABLE_API_KEY para receber sugestões mais inteligentes."],
        summary: "Cidades com mais empresas e baixa cobertura tendem a ter maior potencial.",
      };
    }

    const prompt = [
      "Você é um analista comercial. Com base nestes dados de cobertura territorial,",
      "responda em JSON com:",
      '{ "regions": ["lista de regiões com maior potencial"], "underexplored": ["cidades subexploradas"], "industries": ["segmentos com mais oportunidade"], "actions": ["3 ações práticas para o time"], "summary": "frase única" }',
      "",
      "Cidades:",
      JSON.stringify(topCities, null, 2),
      "Segmentos:",
      JSON.stringify(topIndustries, null, 2),
    ].join("\n");

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You return strict JSON only, no markdown fences." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      const raw = (j?.choices?.[0]?.message?.content ?? "{}").toString();
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      return {
        regions: Array.isArray(parsed.regions) ? parsed.regions.map(String).slice(0, 8) : [],
        underexplored: Array.isArray(parsed.underexplored) ? parsed.underexplored.map(String).slice(0, 8) : [],
        industries: Array.isArray(parsed.industries) ? parsed.industries.map(String).slice(0, 8) : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions.map(String).slice(0, 5) : [],
        summary: String(parsed.summary ?? ""),
      };
    } catch {
      return {
        regions: topCities.slice(0, 5).map((c) => `${c.city}/${c.state}`),
        actions: ["Priorize cidades com maior nº de prospects e baixa cobertura."],
        summary: "Análise heurística (IA indisponível).",
      };
    }
  });
