import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Fase 1 — ERP Mirror server functions.
 * Leem somente dados COMERCIAIS espelhados do ERP.
 * Nada de estoque, fiscal, compras, financeiro operacional.
 */

// ---------- LIST CUSTOMERS ----------
export const listErpCustomers = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        search: z.string().trim().max(120).optional(),
        segment: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from('erp_customers')
      .select(
        'id, external_id, legal_name, trade_name, document, city, state, commercial_status, credit_status, credit_limit, last_purchase_at, company_id',
        { count: 'exact' },
      )
      .eq('organization_id', data.organizationId)
      .order('last_purchase_at', { ascending: false, nullsFirst: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.search) {
      q = q.or(
        `legal_name.ilike.%${data.search}%,trade_name.ilike.%${data.search}%,document.ilike.%${data.search}%`,
      );
    }
    if (data.segment) q = q.eq('segment', data.segment);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });

// ---------- CUSTOMER 360 (versão lite — Fase 1) ----------
export const getErpCustomerOverview = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        erpCustomerId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [customerRes, metricsRes, historyRes] = await Promise.all([
      supabase
        .from('erp_customers')
        .select('*')
        .eq('organization_id', data.organizationId)
        .eq('id', data.erpCustomerId)
        .maybeSingle(),
      supabase
        .from('erp_customer_metrics')
        .select('*')
        .eq('organization_id', data.organizationId)
        .eq('erp_customer_id', data.erpCustomerId)
        .maybeSingle(),
      supabase
        .from('erp_sales_history')
        .select('id, order_date, total_value, item_count, channel, status, sales_rep_external_id')
        .eq('organization_id', data.organizationId)
        .eq('erp_customer_id', data.erpCustomerId)
        .order('order_date', { ascending: false })
        .limit(20),
    ]);

    if (customerRes.error) throw new Error(customerRes.error.message);
    if (metricsRes.error) throw new Error(metricsRes.error.message);
    if (historyRes.error) throw new Error(historyRes.error.message);

    return {
      customer: customerRes.data,
      metrics: metricsRes.data,
      recentOrders: historyRes.data ?? [],
    };
  });

// ---------- SALES REPS ----------
export const listErpSalesReps = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        onlyActive: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from('erp_sales_reps')
      .select('id, external_id, name, email, phone, region, commission_rate, is_active, user_id')
      .eq('organization_id', data.organizationId)
      .order('name');
    if (data.onlyActive) q = q.eq('is_active', true);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

// ---------- COMMERCIAL DASHBOARD KPIs ----------
// Responde: quem vende mais? quem está em risco? qual o pulso comercial?
export const getCommercialPulse = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const since90 = new Date();
    since90.setDate(since90.getDate() - 90);

    const [salesRes, segmentsRes, topCustomersRes, atRiskRes] = await Promise.all([
      // Vendas últimos 90 dias
      supabase
        .from('erp_sales_history')
        .select('total_value, sales_rep_external_id')
        .eq('organization_id', data.organizationId)
        .gte('order_date', since90.toISOString().slice(0, 10)),
      // Distribuição RFM
      supabase
        .from('erp_customer_metrics')
        .select('rfm_segment')
        .eq('organization_id', data.organizationId),
      // Top 10 clientes 365d
      supabase
        .from('erp_customer_metrics')
        .select('erp_customer_id, monetary_365d, avg_ticket, rfm_segment, erp_customers!inner(legal_name, trade_name)')
        .eq('organization_id', data.organizationId)
        .order('monetary_365d', { ascending: false })
        .limit(10),
      // Clientes em risco / hibernando
      supabase
        .from('erp_customer_metrics')
        .select('erp_customer_id, recency_days, monetary_365d, rfm_segment, erp_customers!inner(legal_name, trade_name)')
        .eq('organization_id', data.organizationId)
        .in('rfm_segment', ['at_risk', 'hibernating'])
        .order('monetary_365d', { ascending: false })
        .limit(20),
    ]);

    if (salesRes.error) throw new Error(salesRes.error.message);
    if (segmentsRes.error) throw new Error(segmentsRes.error.message);
    if (topCustomersRes.error) throw new Error(topCustomersRes.error.message);
    if (atRiskRes.error) throw new Error(atRiskRes.error.message);

    const sales = salesRes.data ?? [];
    const revenue90d = sales.reduce((acc, r) => acc + Number(r.total_value ?? 0), 0);
    const orders90d = sales.length;

    // Ranking de reps últimos 90d
    const repMap = new Map<string, number>();
    for (const r of sales) {
      if (!r.sales_rep_external_id) continue;
      repMap.set(
        r.sales_rep_external_id,
        (repMap.get(r.sales_rep_external_id) ?? 0) + Number(r.total_value ?? 0),
      );
    }
    const repRanking = [...repMap.entries()]
      .map(([external_id, revenue]) => ({ external_id, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Distribuição RFM
    const segmentCounts: Record<string, number> = {};
    for (const s of segmentsRes.data ?? []) {
      const key = s.rfm_segment ?? 'unknown';
      segmentCounts[key] = (segmentCounts[key] ?? 0) + 1;
    }

    return {
      revenue90d,
      orders90d,
      avgTicket90d: orders90d ? revenue90d / orders90d : 0,
      repRanking,
      segmentDistribution: segmentCounts,
      topCustomers: topCustomersRes.data ?? [],
      atRiskCustomers: atRiskRes.data ?? [],
    };
  });
