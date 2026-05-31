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

// ============================================================================
// Forecast aggregator (consumed by dashboard / forecast / meu-dia / command)
// ============================================================================

const STAGE_WEIGHTS: Record<string, number> = {
  lead: 0.1,
  qualified: 0.25,
  proposal: 0.5,
  negotiation: 0.75,
};

function ym(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function firstOfMonth(year: number, month1: number) {
  return new Date(Date.UTC(year, month1 - 1, 1));
}
function lastOfMonth(year: number, month1: number) {
  return new Date(Date.UTC(year, month1, 0));
}

export const getForecast = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organization_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const orgId = data.organization_id;

    const now = new Date();
    const monthsList: { year: number; month: number; key: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
      monthsList.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, key: ym(d) });
    }
    const rangeStart = firstOfMonth(monthsList[0].year, monthsList[0].month).toISOString().slice(0, 10);
    const rangeEnd = lastOfMonth(monthsList[5].year, monthsList[5].month).toISOString().slice(0, 10);

    const [dealsOpenRes, dealsWonRes, goalsRes, membersRes] = await Promise.all([
      supabase
        .from('deals')
        .select('id,value,stage,expected_close,user_id')
        .eq('organization_id', orgId)
        .not('stage', 'in', '(won,lost)')
        .limit(10000),
      supabase
        .from('deals')
        .select('id,value,stage,closed_at,user_id')
        .eq('organization_id', orgId)
        .eq('stage', 'won')
        .gte('closed_at', rangeStart)
        .lte('closed_at', rangeEnd + 'T23:59:59Z')
        .limit(10000),
      supabase
        .from('sales_goals')
        .select('user_id,period_month,target_value')
        .eq('organization_id', orgId)
        .gte('period_month', rangeStart)
        .lte('period_month', rangeEnd),
      supabase.from('memberships').select('user_id').eq('organization_id', orgId),
    ]);
    if (dealsOpenRes.error) throw new Error(dealsOpenRes.error.message);
    if (dealsWonRes.error) throw new Error(dealsWonRes.error.message);
    if (goalsRes.error) throw new Error(goalsRes.error.message);

    const dealsOpen = dealsOpenRes.data ?? [];
    const dealsWon = dealsWonRes.data ?? [];
    const goals = goalsRes.data ?? [];
    const memberIds = (membersRes.data ?? []).map((m: any) => m.user_id);

    let profiles: { id: string; full_name: string | null }[] = [];
    if (memberIds.length) {
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', memberIds);
      profiles = data ?? [];
    }
    const nameOf = (uid: string) =>
      profiles.find((p) => p.id === uid)?.full_name ?? 'Sem nome';

    type MAgg = { month: string; target: number; won: number; weighted: number; best: number; committed: number };
    const monthAgg: Record<string, MAgg> = {};
    for (const m of monthsList) {
      monthAgg[m.key] = { month: m.key, target: 0, won: 0, weighted: 0, best: 0, committed: 0 };
    }

    for (const d of dealsOpen) {
      const ec = d.expected_close ? new Date(d.expected_close + 'T00:00:00Z') : null;
      const key = ec ? ym(ec) : monthsList[0].key;
      if (!monthAgg[key]) continue;
      const v = Number(d.value ?? 0);
      const w = STAGE_WEIGHTS[d.stage as string] ?? 0.3;
      monthAgg[key].weighted += v * w;
      monthAgg[key].best += v;
      if (w >= 0.75) monthAgg[key].committed += v;
    }
    for (const d of dealsWon) {
      if (!d.closed_at) continue;
      const key = ym(new Date(d.closed_at));
      if (!monthAgg[key]) continue;
      monthAgg[key].won += Number(d.value ?? 0);
    }
    for (const g of goals) {
      const key = ym(new Date(g.period_month + 'T00:00:00Z'));
      if (!monthAgg[key]) continue;
      if (!g.user_id) monthAgg[key].target += Number(g.target_value ?? 0);
    }

    const currentKey = monthsList[0].key;
    const cur = monthAgg[currentKey];
    const projected = cur.won + cur.weighted;
    const gap = Math.max(0, cur.target - projected);
    const attainment = cur.target > 0 ? Math.round((projected / cur.target) * 100) : 0;

    // Reps
    const repsMap: Record<string, { user_id: string; name: string; target: number; won: number; weighted: number }> = {};
    for (const uid of memberIds) {
      repsMap[uid] = { user_id: uid, name: nameOf(uid), target: 0, won: 0, weighted: 0 };
    }
    for (const d of dealsOpen) {
      if (!d.user_id) continue;
      const ec = d.expected_close ? new Date(d.expected_close + 'T00:00:00Z') : null;
      if (ec && ym(ec) !== currentKey) continue;
      const r = repsMap[d.user_id] || (repsMap[d.user_id] = { user_id: d.user_id, name: nameOf(d.user_id), target: 0, won: 0, weighted: 0 });
      r.weighted += Number(d.value ?? 0) * (STAGE_WEIGHTS[d.stage as string] ?? 0.3);
    }
    for (const d of dealsWon) {
      if (!d.user_id || !d.closed_at) continue;
      if (ym(new Date(d.closed_at)) !== currentKey) continue;
      const r = repsMap[d.user_id] || (repsMap[d.user_id] = { user_id: d.user_id, name: nameOf(d.user_id), target: 0, won: 0, weighted: 0 });
      r.won += Number(d.value ?? 0);
    }
    for (const g of goals) {
      if (!g.user_id) continue;
      const key = ym(new Date(g.period_month + 'T00:00:00Z'));
      if (key !== currentKey) continue;
      const r = repsMap[g.user_id] || (repsMap[g.user_id] = { user_id: g.user_id, name: nameOf(g.user_id), target: 0, won: 0, weighted: 0 });
      r.target += Number(g.target_value ?? 0);
    }

    const reps = Object.values(repsMap)
      .filter((r) => r.target > 0 || r.won > 0 || r.weighted > 0)
      .map((r) => {
        const projected = r.won + r.weighted;
        const gap = Math.max(0, r.target - projected);
        const attainment = r.target > 0 ? Math.round((projected / r.target) * 100) : 0;
        return { ...r, gap, attainment };
      })
      .sort((a, b) => b.attainment - a.attainment);

    return {
      current: {
        month: currentKey,
        target: cur.target,
        won: cur.won,
        weighted: cur.weighted,
        committed: cur.committed,
        best: cur.best,
        projected,
        gap,
        attainment,
      },
      months: monthsList.map((m) => monthAgg[m.key]),
      reps,
    };
  });

export const listGoals = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organization_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: result, error } = await supabase
      .from('sales_goals')
      .select('*')
      .eq('organization_id', data.organization_id)
      .order('period_month', { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { goals: result ?? [] };
  });

export const upsertGoal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      organization_id: z.string().uuid(),
      user_id: z.string().uuid().nullable(),
      period_month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
      target_value: z.number().min(0),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const periodDate = data.period_month.length === 7 ? `${data.period_month}-01` : data.period_month;
    const row = {
      organization_id: data.organization_id,
      user_id: data.user_id,
      period_month: periodDate,
      target_value: data.target_value,
      created_by: userId,
    };
    const { data: result, error } = await supabase
      .from('sales_goals')
      .upsert(row, { onConflict: 'organization_id,user_id,period_month' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return result;
  });

export const deleteGoal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from('sales_goals').delete().eq('id', data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
