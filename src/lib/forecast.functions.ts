import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const getGoalAttainment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ goalId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase.rpc('get_goal_attainment_v2', {
      _goal_id: data.goalId,
    });
    if (error) throw new Error(error.message);
    return { attainment: result?.[0] ?? null };
  });

export const listSalesGoals = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      userId: z.string().uuid().nullable().optional(),
      fromMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      toMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from('sales_goals')
      .select('*')
      .eq('organization_id', data.organizationId)
      .order('period_month', { ascending: false });
    if (data.userId !== undefined) {
      q = data.userId === null ? q.is('user_id', null) : q.eq('user_id', data.userId);
    }
    if (data.fromMonth) q = q.gte('period_month', data.fromMonth);
    if (data.toMonth) q = q.lte('period_month', data.toMonth);
    const { data: result, error } = await q;
    if (error) throw new Error(error.message);
    return { goals: result ?? [] };
  });

export const upsertSalesGoal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      userId: z.string().uuid().nullable().optional(),
      periodMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      targetValue: z.number().min(0),
      targetDealsCount: z.number().int().min(0).default(0),
      currency: z.string().min(3).max(8).default('BRL'),
      notes: z.string().max(2000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      organization_id: data.organizationId,
      user_id: data.userId ?? null,
      period_month: data.periodMonth,
      target_value: data.targetValue,
      target_deals_count: data.targetDealsCount,
      currency: data.currency,
      notes: data.notes ?? null,
      created_by: userId,
    };
    const { data: result, error } = await supabase
      .from('sales_goals')
      .upsert(row, { onConflict: 'organization_id,user_id,period_month' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { goal: result };
  });

export const computeSalesForecast = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      weights: z.record(z.string(), z.number().min(0).max(1)).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const args: Record<string, unknown> = {
      _org: data.organizationId,
      _period_start: data.periodStart,
      _period_end: data.periodEnd,
    };
    if (data.weights) args._weights = data.weights;
    const { data: snapId, error } = await supabase.rpc('compute_sales_forecast', args as never);
    if (error) throw new Error(error.message);
    return { snapshotId: snapId as string };
  });

export const listForecastSnapshots = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organizationId: z.string().uuid(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase
      .from('sales_forecast_snapshots')
      .select('*')
      .eq('organization_id', data.organizationId)
      .order('computed_at', { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { snapshots: result ?? [] };
  });
