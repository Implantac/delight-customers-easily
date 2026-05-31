import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const subjectTypeEnum = z.enum(['contact', 'company', 'deal', 'erp_customer', 'sales_rep']);

/** Top leads pelo score, somente válidos (não expirados). */
export const getTopLeadScores = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        subjectType: z.enum(['contact', 'company', 'deal', 'erp_customer']).optional(),
        tier: z.enum(['hot', 'warm', 'cold']).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from('ai_lead_scores')
      .select('*')
      .eq('organization_id', data.organizationId)
      .gt('expires_at', new Date().toISOString())
      .order('score', { ascending: false })
      .limit(data.limit);
    if (data.subjectType) q = q.eq('subject_type', data.subjectType);
    if (data.tier) q = q.eq('tier', data.tier);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

/** Clientes em risco (churn). */
export const getChurnRisks = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        minRisk: z.enum(['low', 'medium', 'high', 'critical']).default('high'),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ranking = { low: 1, medium: 2, high: 3, critical: 4 } as const;
    const allowed = (Object.keys(ranking) as Array<keyof typeof ranking>).filter(
      (k) => ranking[k] >= ranking[data.minRisk],
    );
    const { data: rows, error } = await supabase
      .from('ai_churn_predictions')
      .select('*')
      .eq('organization_id', data.organizationId)
      .in('risk_level', allowed)
      .gt('expires_at', new Date().toISOString())
      .order('churn_probability', { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

/** Próximas recompras esperadas. */
export const getUpcomingRepurchases = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        windowDays: z.number().int().min(1).max(180).default(30),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const upper = new Date(Date.now() + data.windowDays * 86_400_000).toISOString();
    const { data: rows, error } = await supabase
      .from('ai_repurchase_predictions')
      .select('*')
      .eq('organization_id', data.organizationId)
      .gt('expires_at', new Date().toISOString())
      .lte('expected_purchase_at', upper)
      .order('expected_purchase_at', { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

/** Recomendações pendentes. */
export const listAiRecommendations = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        subjectType: subjectTypeEnum.optional(),
        subjectId: z.string().uuid().optional(),
        status: z.enum(['pending', 'accepted', 'dismissed', 'expired']).default('pending'),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from('ai_recommendations')
      .select('*')
      .eq('organization_id', data.organizationId)
      .eq('status', data.status)
      .order('priority', { ascending: false })
      .limit(data.limit);
    if (data.subjectType) q = q.eq('subject_type', data.subjectType);
    if (data.subjectId) q = q.eq('subject_id', data.subjectId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

/** Aceitar/descartar recomendação. */
export const updateRecommendationStatus = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        recommendationId: z.string().uuid(),
        status: z.enum(['accepted', 'dismissed']),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from('ai_recommendations')
      .update({ status: data.status })
      .eq('id', data.recommendationId)
      .eq('organization_id', data.organizationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
