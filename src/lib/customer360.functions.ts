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

/**
 * Timeline unificada leve para inline preview no Customer 360.
 * Combina: atividades (via contatos/deals), eventos de deals (stage/won/lost),
 * WhatsApp (via conversas dos contatos) e faturas emitidas.
 * Todos os canais em UMA lista ordenada por data desc, limitada a N eventos.
 */
export type Customer360TimelineEvent = {
  id: string;
  kind: 'activity' | 'deal' | 'whatsapp' | 'invoice' | 'won' | 'lost';
  type?: string | null;
  title: string;
  date: string;
  meta?: string | null;
  completed?: boolean;
};

export const getCustomer360Timeline = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        companyId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(15),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ items: Customer360TimelineEvent[] }> => {
    const { supabase } = context;
    const orgId = data.organizationId;
    const companyId = data.companyId;

    // Ids relacionados (contatos + deals dessa empresa) para varrer canais laterais
    const [{ data: contacts }, { data: deals }] = await Promise.all([
      supabase.from('contacts').select('id').eq('organization_id', orgId).eq('company_id', companyId).limit(200),
      supabase
        .from('deals')
        .select('id, title, value, stage, closed_at, updated_at, created_at')
        .eq('organization_id', orgId)
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false })
        .limit(50),
    ]);
    const contactIds = (contacts ?? []).map((c) => c.id);
    const dealIds = (deals ?? []).map((d) => d.id);

    // Atividades (ligadas a esses deals ou contatos)
    let activitiesPromise: PromiseLike<{ data: any[] | null }> = Promise.resolve({ data: [] });
    if (dealIds.length > 0 || contactIds.length > 0) {
      let aq = supabase
        .from('activities')
        .select('id, title, type, due_date, completed, created_at')
        .eq('organization_id', orgId);
      if (dealIds.length > 0 && contactIds.length > 0) {
        aq = aq.or(`deal_id.in.(${dealIds.join(',')}),contact_id.in.(${contactIds.join(',')})`);
      } else if (dealIds.length > 0) {
        aq = aq.in('deal_id', dealIds);
      } else {
        aq = aq.in('contact_id', contactIds);
      }
      activitiesPromise = aq.order('due_date', { ascending: false, nullsFirst: false }).limit(20);
    }

    // WhatsApp (via conversas dos contatos)
    let waPromise: PromiseLike<{ data: any[] | null }> = Promise.resolve({ data: [] });
    if (contactIds.length > 0) {
      const { data: convs } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('organization_id', orgId)
        .in('contact_id', contactIds);
      const convIds = (convs ?? []).map((c) => c.id);
      if (convIds.length > 0) {
        waPromise = supabase
          .from('whatsapp_messages')
          .select('id, body, direction, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(15);
      }
    }

    const [invoicesR, activitiesR, waR] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, amount, status, issued_at, number')
        .eq('organization_id', orgId)
        .eq('company_id', companyId)
        .order('issued_at', { ascending: false })
        .limit(10),
      activitiesPromise,
      waPromise,
    ]);

    const items: Customer360TimelineEvent[] = [];

    for (const a of (activitiesR.data ?? []) as any[]) {
      items.push({
        id: a.id,
        kind: 'activity',
        type: a.type,
        title: a.title ?? 'Atividade',
        date: a.due_date ?? a.created_at,
        completed: !!a.completed,
      });
    }
    for (const d of (deals ?? []) as any[]) {
      if (d.stage === 'won') {
        items.push({
          id: `won-${d.id}`,
          kind: 'won',
          title: `Ganho: ${d.title}`,
          date: d.closed_at ?? d.updated_at ?? d.created_at,
          meta: d.value ? `R$ ${Number(d.value).toLocaleString('pt-BR')}` : null,
        });
      } else if (d.stage === 'lost') {
        items.push({
          id: `lost-${d.id}`,
          kind: 'lost',
          title: `Perda: ${d.title}`,
          date: d.closed_at ?? d.updated_at ?? d.created_at,
        });
      } else {
        items.push({
          id: `deal-${d.id}`,
          kind: 'deal',
          title: d.title,
          date: d.updated_at ?? d.created_at,
          meta: d.value ? `R$ ${Number(d.value).toLocaleString('pt-BR')} · ${d.stage}` : d.stage,
        });
      }
    }
    for (const m of (waR.data ?? []) as any[]) {
      items.push({
        id: m.id,
        kind: 'whatsapp',
        title: (m.body ?? '').slice(0, 140) || '(mensagem)',
        date: m.created_at,
        meta: m.direction === 'in' ? 'recebida' : 'enviada',
      });
    }
    for (const inv of (invoicesR.data ?? []) as any[]) {
      items.push({
        id: inv.id,
        kind: 'invoice',
        title: `Fatura ${inv.number ?? ''}`.trim(),
        date: inv.issued_at,
        meta: `R$ ${Number(inv.amount ?? 0).toLocaleString('pt-BR')} · ${inv.status}`,
      });
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { items: items.slice(0, data.limit) };
  });
