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
