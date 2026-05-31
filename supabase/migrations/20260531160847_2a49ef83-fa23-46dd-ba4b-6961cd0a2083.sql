-- Phase 3: Multiempresa formal (Tenant → Empresa → Filial)

-- 1. Enum org_type
DO $$ BEGIN
  CREATE TYPE public.org_type AS ENUM ('tenant', 'company', 'branch');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add columns to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS org_type public.org_type NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS external_company_code text,
  ADD COLUMN IF NOT EXISTS external_branch_code text;

CREATE INDEX IF NOT EXISTS organizations_org_type_idx ON public.organizations(org_type);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_cnpj_unique
  ON public.organizations(cnpj) WHERE cnpj IS NOT NULL;

-- 3. Hierarchy validation: branch must have a company parent; company must have a tenant parent (or be root); tenant has no parent
CREATE OR REPLACE FUNCTION public.validate_org_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_type public.org_type;
BEGIN
  IF NEW.parent_org_id IS NULL THEN
    IF NEW.org_type = 'branch' THEN
      RAISE EXCEPTION 'Filial deve ter uma empresa (parent_org_id) como pai';
    END IF;
    RETURN NEW;
  END IF;

  SELECT org_type INTO parent_type FROM public.organizations WHERE id = NEW.parent_org_id;

  IF NEW.org_type = 'branch' AND parent_type <> 'company' THEN
    RAISE EXCEPTION 'Pai de uma filial deve ser uma empresa (company)';
  END IF;
  IF NEW.org_type = 'company' AND parent_type <> 'tenant' THEN
    RAISE EXCEPTION 'Pai de uma empresa deve ser um tenant';
  END IF;
  IF NEW.org_type = 'tenant' AND NEW.parent_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant não pode ter pai';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_org_hierarchy ON public.organizations;
CREATE TRIGGER trg_validate_org_hierarchy
  BEFORE INSERT OR UPDATE OF org_type, parent_org_id ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.validate_org_hierarchy();

-- 4. Ancestor helpers
CREATE OR REPLACE FUNCTION public.org_ancestors(_org uuid)
RETURNS TABLE(organization_id uuid, org_type public.org_type, depth int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT o.id, o.parent_org_id, o.org_type, 0 AS depth
      FROM public.organizations o WHERE o.id = _org
    UNION ALL
    SELECT o.id, o.parent_org_id, o.org_type, t.depth + 1
      FROM public.organizations o
      JOIN tree t ON o.id = t.parent_org_id
  )
  SELECT id, org_type, depth FROM tree;
$$;

CREATE OR REPLACE FUNCTION public.org_tenant_root(_org uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.org_ancestors(_org)
   WHERE org_type = 'tenant' LIMIT 1;
$$;

-- 5. Consolidated view: sales by company (aggregates branches under each company within tenant scope)
CREATE OR REPLACE VIEW public.org_sales_consolidated_by_company
WITH (security_invoker = true) AS
SELECT
  company.id            AS company_org_id,
  company.name          AS company_name,
  tenant.id             AS tenant_org_id,
  COUNT(DISTINCT s.id)  AS orders_90d,
  COALESCE(SUM(s.total_value), 0)::numeric AS revenue_90d,
  COUNT(DISTINCT s.erp_customer_id) AS distinct_customers_90d
FROM public.organizations company
JOIN public.organizations tenant
  ON tenant.id = company.parent_org_id AND tenant.org_type = 'tenant'
LEFT JOIN public.organizations branch
  ON branch.parent_org_id = company.id AND branch.org_type = 'branch'
LEFT JOIN public.erp_sales_history s
  ON s.organization_id IN (company.id, branch.id)
 AND s.order_date >= now() - INTERVAL '90 days'
WHERE company.org_type = 'company'
GROUP BY company.id, company.name, tenant.id;

-- 6. Consolidated view: sales by branch
CREATE OR REPLACE VIEW public.org_sales_consolidated_by_branch
WITH (security_invoker = true) AS
SELECT
  branch.id           AS branch_org_id,
  branch.name         AS branch_name,
  company.id          AS company_org_id,
  company.name        AS company_name,
  tenant.id           AS tenant_org_id,
  COUNT(DISTINCT s.id) AS orders_90d,
  COALESCE(SUM(s.total_value), 0)::numeric AS revenue_90d,
  COUNT(DISTINCT s.erp_customer_id) AS distinct_customers_90d
FROM public.organizations branch
JOIN public.organizations company
  ON company.id = branch.parent_org_id AND company.org_type = 'company'
JOIN public.organizations tenant
  ON tenant.id = company.parent_org_id AND tenant.org_type = 'tenant'
LEFT JOIN public.erp_sales_history s
  ON s.organization_id = branch.id
 AND s.order_date >= now() - INTERVAL '90 days'
WHERE branch.org_type = 'branch'
GROUP BY branch.id, branch.name, company.id, company.name, tenant.id;

GRANT SELECT ON public.org_sales_consolidated_by_company TO authenticated;
GRANT SELECT ON public.org_sales_consolidated_by_branch TO authenticated;
GRANT SELECT ON public.org_sales_consolidated_by_company TO service_role;
GRANT SELECT ON public.org_sales_consolidated_by_branch TO service_role;

-- 7. Function: consolidated rollup for a given root org (tenant/company), respecting RLS via is_org_or_descendant_member
CREATE OR REPLACE FUNCTION public.get_org_consolidated_rollup(_root_org uuid, _days int DEFAULT 90)
RETURNS TABLE(
  org_id uuid,
  org_name text,
  org_type public.org_type,
  orders_count bigint,
  revenue numeric,
  distinct_customers bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_or_descendant_member(_root_org, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado ao nó organizacional';
  END IF;

  RETURN QUERY
  SELECT
    o.id, o.name, o.org_type,
    COUNT(DISTINCT s.id)::bigint,
    COALESCE(SUM(s.total_value), 0)::numeric,
    COUNT(DISTINCT s.erp_customer_id)::bigint
  FROM public.organizations o
  LEFT JOIN public.erp_sales_history s
    ON s.organization_id = o.id
   AND s.order_date >= now() - make_interval(days => _days)
  WHERE o.id IN (SELECT organization_id FROM public.org_descendants(_root_org))
  GROUP BY o.id, o.name, o.org_type
  ORDER BY o.org_type, o.name;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_org_consolidated_rollup(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_consolidated_rollup(uuid, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.org_ancestors(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_ancestors(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.org_tenant_root(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_tenant_root(uuid) TO authenticated;