import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===========================================================================
// Geointeligência: clientes por cidade/estado + sugestão de rota por IA.
// Sem mapa real (não usamos provedor externo); trabalhamos em nível de
// cidade/estado e indústria. Quando lat/lng existirem, viram pontos no mapa.
// ===========================================================================

const orgInput = z.object({ organization_id: z.string().uuid() });

export type GeoCompany = {
  id: string;
  name: string;
  industry: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  open_value: number;
  won_value: number;
  last_activity_at: string | null;
};

export const getGeoOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const [coRes, dealsRes, actRes] = await Promise.all([
      supabase
        .from("companies")
        .select("id,name,industry,city,state,latitude,longitude")
        .eq("organization_id", org),
      supabase
        .from("deals")
        .select("company_id,stage,value")
        .eq("organization_id", org),
      supabase
        .from("activities")
        .select("company_id,created_at")
        .eq("organization_id", org)
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    const companies = coRes.data ?? [];
    const deals = dealsRes.data ?? [];
    const acts = actRes.data ?? [];

    const valByCo = new Map<string, { open: number; won: number }>();
    for (const d of deals) {
      if (!d.company_id) continue;
      const v = Number(d.value || 0);
      const cur = valByCo.get(d.company_id) ?? { open: 0, won: 0 };
      if (d.stage === "won") cur.won += v;
      else if (d.stage !== "lost") cur.open += v;
      valByCo.set(d.company_id, cur);
    }

    const lastAct = new Map<string, string>();
    for (const a of acts) {
      if (!a.company_id) continue;
      if (!lastAct.has(a.company_id)) lastAct.set(a.company_id, a.created_at as string);
    }

    const enriched: GeoCompany[] = companies.map((c: any) => {
      const v = valByCo.get(c.id) ?? { open: 0, won: 0 };
      return {
        id: c.id,
        name: c.name,
        industry: c.industry ?? null,
        city: c.city ?? null,
        state: c.state ?? null,
        latitude: c.latitude ?? null,
        longitude: c.longitude ?? null,
        open_value: v.open,
        won_value: v.won,
        last_activity_at: lastAct.get(c.id) ?? null,
      };
    });

    // Agrega por cidade/estado
    type Bucket = {
      key: string; city: string; state: string;
      companies: number; open_value: number; won_value: number;
    };
    const cells = new Map<string, Bucket>();
    for (const c of enriched) {
      const city = c.city?.trim() || "Sem cidade";
      const state = c.state?.trim() || "—";
      const key = `${state}||${city}`;
      const cur = cells.get(key) ?? { key, city, state, companies: 0, open_value: 0, won_value: 0 };
      cur.companies += 1;
      cur.open_value += c.open_value;
      cur.won_value += c.won_value;
      cells.set(key, cur);
    }
    const cities = [...cells.values()].sort((a, b) => b.open_value + b.won_value - a.open_value - a.won_value);

    const states = new Map<string, { state: string; companies: number; open_value: number; won_value: number }>();
    for (const c of cities) {
      const cur = states.get(c.state) ?? { state: c.state, companies: 0, open_value: 0, won_value: 0 };
      cur.companies += c.companies;
      cur.open_value += c.open_value;
      cur.won_value += c.won_value;
      states.set(c.state, cur);
    }

    return {
      companies: enriched,
      cities,
      states: [...states.values()].sort((a, b) => b.companies - a.companies),
      summary: {
        total: enriched.length,
        with_coords: enriched.filter((c) => c.latitude != null && c.longitude != null).length,
        with_location: enriched.filter((c) => c.city || c.state).length,
        open_value: enriched.reduce((s, c) => s + c.open_value, 0),
      },
    };
  });

// ---------------------------------------------------------------------------
// Sugestão de rota: dado uma cidade/estado, sugere até N clientes/prospects
// para visitar hoje, priorizando: pipeline aberto, ausência de contato recente,
// e mesmo segmento (CNAE) dos melhores clientes.
// ---------------------------------------------------------------------------

export const suggestRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      city: z.string().optional(),
      state: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(8),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const overview = await getGeoOverview({
      data: { organization_id: data.organization_id },
    });

    // segmentos dos top clientes (won_value)
    const topByWon = [...overview.companies].sort((a, b) => b.won_value - a.won_value).slice(0, 20);
    const topSegments = new Set(topByWon.map((c) => c.industry).filter(Boolean) as string[]);

    const now = Date.now();
    const candidates = overview.companies
      .filter((c) => (!data.city || c.city === data.city) && (!data.state || c.state === data.state))
      .map((c) => {
        const daysSilent = c.last_activity_at
          ? Math.floor((now - new Date(c.last_activity_at).getTime()) / 86_400_000)
          : 999;
        const segMatch = c.industry && topSegments.has(c.industry) ? 1 : 0;
        const score =
          (c.open_value / 10_000) * 0.5 +
          Math.min(daysSilent, 180) * 0.2 +
          segMatch * 30 +
          (c.won_value > 0 ? 10 : 0);
        return { ...c, daysSilent, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, data.limit);

    return { route: candidates };
  });
