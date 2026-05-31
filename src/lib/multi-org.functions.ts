import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/**
 * Lista a árvore de organizações (tenant → empresas → filiais)
 * a que o usuário tem acesso, partindo de uma raiz (ou do tenant atual).
 */
export const getOrgTree = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ rootOrgId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ root: string | null; nodes: Array<{ id: string; name: string; slug: string; org_type: string; parent_org_id: string | null; cnpj: string | null; legal_name: string | null; external_company_code: string | null; external_branch_code: string | null }> }> => {
    const { supabase, userId } = context;

    let rootId = data.rootOrgId;
    if (!rootId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('current_organization_id')
        .eq('id', userId)
        .maybeSingle();
      if (!prof?.current_organization_id) {
        return { root: null, nodes: [] as Array<Record<string, unknown>> };
      }
      const { data: rootRow } = await supabase.rpc('org_tenant_root', {
        _org: prof.current_organization_id,
      });
      rootId = (rootRow as string | null) ?? prof.current_organization_id;
    }

    const { data: nodes, error } = await supabase
      .from('organizations')
      .select('id, name, slug, org_type, parent_org_id, cnpj, legal_name, external_company_code, external_branch_code')
      .or(`id.eq.${rootId},parent_org_id.eq.${rootId}`);
    if (error) throw new Error(error.message);

    const ids = (nodes ?? []).map((n) => n.id);
    let descendants: typeof nodes = [];
    if (ids.length) {
      const { data: more } = await supabase
        .from('organizations')
        .select('id, name, slug, org_type, parent_org_id, cnpj, legal_name, external_company_code, external_branch_code')
        .in('parent_org_id', ids);
      descendants = more ?? [];
    }

    const all = [...(nodes ?? []), ...(descendants ?? [])];
    const seen = new Set<string>();
    const unique = all.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)));

    return { root: rootId, nodes: unique };
  });

/**
 * Cria uma empresa (company) ou filial (branch) dentro do tenant atual.
 * Apenas owner/admin do tenant raiz pode criar.
 */
export const createOrgNode = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        parentOrgId: z.string().uuid(),
        name: z.string().min(1).max(255),
        orgType: z.enum(['company', 'branch']),
        cnpj: z.string().max(20).optional(),
        legalName: z.string().max(255).optional(),
        externalCompanyCode: z.string().max(64).optional(),
        externalBranchCode: z.string().max(64).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: canManage } = await supabase.rpc('has_org_role', {
      _org: data.parentOrgId,
      _user: userId,
      _roles: ['owner', 'admin'] as unknown as string[],
    });
    if (!canManage) throw new Error('Sem permissão para criar nós organizacionais');

    const baseSlug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40);
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

    const { data: inserted, error } = await supabase
      .from('organizations')
      .insert({
        name: data.name,
        slug,
        created_by: userId,
        parent_org_id: data.parentOrgId,
        org_type: data.orgType,
        cnpj: data.cnpj ?? null,
        legal_name: data.legalName ?? null,
        external_company_code: data.externalCompanyCode ?? null,
        external_branch_code: data.externalBranchCode ?? null,
      })
      .select('id, name, slug, org_type, parent_org_id')
      .single();
    if (error) throw new Error(error.message);

    await supabase
      .from('memberships')
      .insert({ organization_id: inserted.id, user_id: userId, role: 'owner' });

    return { node: inserted };
  });

/**
 * Rollup consolidado (vendas) por nó a partir de uma raiz, respeitando hierarquia.
 */
export const getConsolidatedRollup = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        rootOrgId: z.string().uuid(),
        days: z.number().int().min(1).max(365).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc('get_org_consolidated_rollup', {
      _root_org: data.rootOrgId,
      _days: data.days ?? 90,
    });
    if (error) throw new Error(error.message);

    const items = (rows ?? []) as Array<{
      org_id: string;
      org_name: string;
      org_type: 'tenant' | 'company' | 'branch';
      orders_count: number;
      revenue: number;
      distinct_customers: number;
    }>;

    const totals = items.reduce(
      (acc, r) => ({
        orders: acc.orders + Number(r.orders_count ?? 0),
        revenue: acc.revenue + Number(r.revenue ?? 0),
        customers: acc.customers + Number(r.distinct_customers ?? 0),
      }),
      { orders: 0, revenue: 0, customers: 0 },
    );

    return { items, totals };
  });
