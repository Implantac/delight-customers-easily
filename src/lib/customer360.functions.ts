import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

/** Lista clientes do snapshot 360 com filtros e paginação. */
export const listCustomer360 = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        segment: z.string().max(64).optional(),
        search: z.string().max(120).optional(),
        sort: z.enum(['monetary', 'recency', 'open_value']).default('monetary'),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from('customer_360_snapshot')
      .select('*', { count: 'exact' })
      .eq('organization_id', data.organizationId);

    if (data.segment) q = q.eq('rfm_segment', data.segment);
    if (data.search) q = q.or(`display_name.ilike.%${data.search}%,cnpj.ilike.%${data.search}%`);

    const sortCol =
      data.sort === 'recency'
        ? 'last_purchase_at'
        : data.sort === 'open_value'
          ? 'open_deals_value'
          : 'monetary';
    q = q.order(sortCol, { ascending: false, nullsFirst: false });
    q = q.range(data.offset, data.offset + data.limit - 1);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [], total: count ?? 0 };
  });

/** Snapshot consolidado de UM cliente. */
export const getCustomer360 = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        erpCustomerId: z.string().uuid().optional(),
        companyId: z.string().uuid().optional(),
      })
      .refine((d) => d.erpCustomerId || d.companyId, 'erpCustomerId ou companyId obrigatório')
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from('customer_360_snapshot')
      .select('*')
      .eq('organization_id', data.organizationId);
    if (data.erpCustomerId) q = q.eq('erp_customer_id', data.erpCustomerId);
    else if (data.companyId) q = q.eq('company_id', data.companyId);

    const { data: row, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    return { snapshot: row };
  });

/** Força o refresh do snapshot para a organização. Apenas owner/admin. */
export const refreshCustomer360 = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ok } = await supabase.rpc('has_org_role', {
      _org: data.organizationId,
      _user: userId,
      _roles: ['owner', 'admin'],
    });
    if (!ok) throw new Error('Apenas owner/admin pode forçar refresh');

    const { data: affected, error } = await supabaseAdmin.rpc('refresh_customer_360', {
      _org: data.organizationId,
    });
    if (error) throw new Error(error.message);
    return { affected: (affected as number | null) ?? 0 };
  });
