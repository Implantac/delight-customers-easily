import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const upsertLocationSchema = z.object({
  organizationId: z.string().uuid(),
  subjectType: z.enum(['company', 'contact', 'erp_customer', 'lead']),
  subjectId: z.string().uuid(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  cep: z.string().max(16).nullable().optional(),
  street: z.string().max(255).nullable().optional(),
  number: z.string().max(32).nullable().optional(),
  complement: z.string().max(255).nullable().optional(),
  neighborhood: z.string().max(255).nullable().optional(),
  city: z.string().max(255).nullable().optional(),
  state: z.string().max(8).nullable().optional(),
  ibgeCode: z.string().max(16).nullable().optional(),
  source: z.string().max(64).optional(),
});

export const upsertGeoLocation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertLocationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const row = {
      organization_id: data.organizationId,
      subject_type: data.subjectType,
      subject_id: data.subjectId,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      cep: data.cep ?? null,
      street: data.street ?? null,
      number: data.number ?? null,
      complement: data.complement ?? null,
      neighborhood: data.neighborhood ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      ibge_code: data.ibgeCode ?? null,
      source: data.source ?? 'manual',
      geocoded_at: data.latitude != null && data.longitude != null ? new Date().toISOString() : null,
    };
    const { data: result, error } = await supabase
      .from('geo_locations')
      .upsert(row, { onConflict: 'organization_id,subject_type,subject_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { location: result };
  });

export const findOpportunitiesInRadius = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      radiusKm: z.number().min(0.1).max(2000).default(25),
      subjectTypes: z.array(z.enum(['company', 'contact', 'erp_customer', 'lead'])).default(['company', 'erp_customer', 'lead']),
      limit: z.number().int().min(1).max(500).default(100),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc('find_opportunities_in_radius', {
      _org: data.organizationId,
      _lat: data.latitude,
      _lng: data.longitude,
      _radius_km: data.radiusKm,
      _subject_types: data.subjectTypes,
      _limit: data.limit,
    });
    if (error) throw new Error(error.message);
    return { opportunities: result ?? [] };
  });

export const getRegionalRollup = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      days: z.number().int().min(1).max(730).default(90),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc('get_regional_sales_rollup', {
      _org: data.organizationId,
      _days: data.days,
    });
    if (error) throw new Error(error.message);
    return { regions: result ?? [] };
  });

const territorySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  states: z.array(z.string().max(8)).max(50).default([]),
  cities: z.array(z.string().max(255)).max(500).default([]),
  centerLat: z.number().min(-90).max(90).nullable().optional(),
  centerLng: z.number().min(-180).max(180).nullable().optional(),
  radiusKm: z.number().min(0).max(5000).nullable().optional(),
  polygonGeojson: z.unknown().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const createTerritory = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => territorySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase
      .from('geo_territories')
      .insert({
        organization_id: data.organizationId,
        name: data.name,
        description: data.description ?? null,
        owner_user_id: data.ownerUserId ?? null,
        states: data.states,
        cities: data.cities,
        center_lat: data.centerLat ?? null,
        center_lng: data.centerLng ?? null,
        radius_km: data.radiusKm ?? null,
        polygon_geojson: (data.polygonGeojson as never) ?? null,
        is_active: data.isActive,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { territory: result };
  });

export const listTerritories = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      onlyActive: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from('geo_territories')
      .select('*')
      .eq('organization_id', data.organizationId)
      .order('name', { ascending: true });
    if (data.onlyActive) q = q.eq('is_active', true);
    const { data: result, error } = await q;
    if (error) throw new Error(error.message);
    return { territories: result ?? [] };
  });

const routePlanStopSchema = z.object({
  subjectType: z.enum(['company', 'contact', 'erp_customer', 'lead']),
  subjectId: z.string().uuid(),
  order: z.number().int().min(0),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  note: z.string().max(500).optional(),
});

const routePlanSchema = z.object({
  organizationId: z.string().uuid(),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(1).max(255),
  startLat: z.number().min(-90).max(90).nullable().optional(),
  startLng: z.number().min(-180).max(180).nullable().optional(),
  stops: z.array(routePlanStopSchema).min(1).max(50),
  notes: z.string().max(2000).nullable().optional(),
});

export const createRoutePlan = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => routePlanSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: result, error } = await supabase
      .from('geo_route_plans')
      .insert({
        organization_id: data.organizationId,
        owner_user_id: userId,
        plan_date: data.planDate,
        title: data.title,
        start_lat: data.startLat ?? null,
        start_lng: data.startLng ?? null,
        stops: data.stops,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { plan: result };
  });

export const listRoutePlans = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      onlyMine: z.boolean().default(false),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from('geo_route_plans')
      .select('*')
      .eq('organization_id', data.organizationId)
      .order('plan_date', { ascending: false })
      .limit(data.limit);
    if (data.fromDate) q = q.gte('plan_date', data.fromDate);
    if (data.toDate) q = q.lte('plan_date', data.toDate);
    if (data.onlyMine) q = q.eq('owner_user_id', userId);
    const { data: result, error } = await q;
    if (error) throw new Error(error.message);
    return { plans: result ?? [] };
  });

type CompanyAgg = {
  industry: string;
  size: string;
  companies: number;
  open_deals: number;
  open_value: number;
  won_value: number;
  company_list: { id: string; name: string; open_value: number }[];
};

type IndustryAgg = { industry: string; companies: number; open_value: number };

export const getOpportunityMap = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organization_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const [companiesRes, dealsRes] = await Promise.all([
      supabase
        .from('companies')
        .select('id,name,industry,size')
        .eq('organization_id', org)
        .limit(5000),
      supabase
        .from('deals')
        .select('id,company_id,stage,value')
        .eq('organization_id', org)
        .limit(10000),
    ]);
    if (companiesRes.error) throw new Error(companiesRes.error.message);
    if (dealsRes.error) throw new Error(dealsRes.error.message);

    const companies = companiesRes.data ?? [];
    const deals = dealsRes.data ?? [];

    const openByCompany = new Map<string, number>();
    const wonByCompany = new Map<string, number>();
    const openCountByCompany = new Map<string, number>();
    for (const d of deals) {
      if (!d.company_id) continue;
      const v = Number(d.value ?? 0);
      if (d.stage === 'won') {
        wonByCompany.set(d.company_id, (wonByCompany.get(d.company_id) ?? 0) + v);
      } else if (d.stage !== 'lost') {
        openByCompany.set(d.company_id, (openByCompany.get(d.company_id) ?? 0) + v);
        openCountByCompany.set(d.company_id, (openCountByCompany.get(d.company_id) ?? 0) + 1);
      }
    }

    const territoryMap = new Map<string, CompanyAgg>();
    const industryMap = new Map<string, IndustryAgg>();
    let totalOpen = 0;
    let totalWon = 0;

    for (const c of companies) {
      const industry = (c.industry ?? 'Sem setor').toString();
      const size = (c.size ?? 'Sem porte').toString();
      const key = `${industry}__${size}`;
      const openVal = openByCompany.get(c.id) ?? 0;
      const wonVal = wonByCompany.get(c.id) ?? 0;
      const openCnt = openCountByCompany.get(c.id) ?? 0;
      totalOpen += openVal;
      totalWon += wonVal;

      let t = territoryMap.get(key);
      if (!t) {
        t = { industry, size, companies: 0, open_deals: 0, open_value: 0, won_value: 0, company_list: [] };
        territoryMap.set(key, t);
      }
      t.companies += 1;
      t.open_deals += openCnt;
      t.open_value += openVal;
      t.won_value += wonVal;
      if (t.company_list.length < 10) {
        t.company_list.push({ id: c.id, name: c.name, open_value: openVal });
      }

      let ind = industryMap.get(industry);
      if (!ind) {
        ind = { industry, companies: 0, open_value: 0 };
        industryMap.set(industry, ind);
      }
      ind.companies += 1;
      ind.open_value += openVal;
    }

    const territories = Array.from(territoryMap.values()).sort((a, b) => b.open_value - a.open_value);
    const industries = Array.from(industryMap.values()).sort((a, b) => b.open_value - a.open_value);

    return {
      territories,
      industries,
      summary: {
        total_companies: companies.length,
        territories_count: territories.length,
        total_open_value: totalOpen,
        total_won_value: totalWon,
      },
    };
  });
