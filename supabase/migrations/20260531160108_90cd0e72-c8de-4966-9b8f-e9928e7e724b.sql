
-- Fase 1: ERP Mirror — tabelas-espelho de dados COMERCIAIS do ERP
-- Princípio: só dado comercial. Nada de estoque, fiscal, financeiro operacional, compras.

-- =========================================================
-- 1) erp_customers — espelho de cliente do ERP
-- =========================================================
CREATE TABLE public.erp_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.erp_integrations(id) ON DELETE SET NULL,
  external_id text NOT NULL,                       -- id do cliente no ERP
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL, -- vínculo com CRM
  document text,                                   -- CNPJ/CPF
  legal_name text,
  trade_name text,
  email text,
  phone text,
  segment text,
  city text,
  state text,
  zip text,
  sales_rep_external_id text,                      -- representante no ERP
  credit_limit numeric(14,2),                      -- consulta apenas
  credit_status text,                              -- ok | hold | blocked (consulta)
  commercial_status text,                          -- active | inactive | prospect
  first_purchase_at timestamptz,
  last_purchase_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,          -- payload bruto para auditoria
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, integration_id, external_id)
);
CREATE INDEX idx_erp_customers_org_company ON public.erp_customers(organization_id, company_id);
CREATE INDEX idx_erp_customers_org_doc ON public.erp_customers(organization_id, document);
CREATE INDEX idx_erp_customers_org_last_purchase ON public.erp_customers(organization_id, last_purchase_at DESC NULLS LAST);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_customers TO authenticated;
GRANT ALL ON public.erp_customers TO service_role;
ALTER TABLE public.erp_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_customers org members read" ON public.erp_customers
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "erp_customers org admins write" ON public.erp_customers
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER trg_erp_customers_updated_at
  BEFORE UPDATE ON public.erp_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 2) erp_sales_reps — representantes comerciais vindos do ERP
-- =========================================================
CREATE TABLE public.erp_sales_reps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.erp_integrations(id) ON DELETE SET NULL,
  external_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- vínculo com usuário do CRM
  name text NOT NULL,
  email text,
  phone text,
  region text,
  commission_rate numeric(6,4),
  is_active boolean NOT NULL DEFAULT true,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, integration_id, external_id)
);
CREATE INDEX idx_erp_sales_reps_org_user ON public.erp_sales_reps(organization_id, user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_sales_reps TO authenticated;
GRANT ALL ON public.erp_sales_reps TO service_role;
ALTER TABLE public.erp_sales_reps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_sales_reps org members read" ON public.erp_sales_reps
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "erp_sales_reps org admins write" ON public.erp_sales_reps
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER trg_erp_sales_reps_updated_at
  BEFORE UPDATE ON public.erp_sales_reps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 3) erp_sales_history — histórico de pedidos (agregado comercial)
-- Apenas cabeçalho comercial. Sem itens fiscais, sem impostos.
-- =========================================================
CREATE TABLE public.erp_sales_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.erp_integrations(id) ON DELETE SET NULL,
  external_id text NOT NULL,                         -- id do pedido no ERP
  erp_customer_id uuid REFERENCES public.erp_customers(id) ON DELETE SET NULL,
  customer_external_id text,                         -- redundância p/ idempotência
  sales_rep_external_id text,
  order_date date NOT NULL,
  total_value numeric(14,2) NOT NULL DEFAULT 0,
  item_count integer,
  channel text,                                      -- balcão, representante, ecommerce, etc.
  status text,                                       -- faturado | cancelado | pendente
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, integration_id, external_id)
);
CREATE INDEX idx_erp_sales_history_org_date ON public.erp_sales_history(organization_id, order_date DESC);
CREATE INDEX idx_erp_sales_history_org_customer ON public.erp_sales_history(organization_id, erp_customer_id, order_date DESC);
CREATE INDEX idx_erp_sales_history_org_rep ON public.erp_sales_history(organization_id, sales_rep_external_id, order_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_sales_history TO authenticated;
GRANT ALL ON public.erp_sales_history TO service_role;
ALTER TABLE public.erp_sales_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_sales_history org members read" ON public.erp_sales_history
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "erp_sales_history org admins write" ON public.erp_sales_history
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- =========================================================
-- 4) erp_customer_metrics — métricas RFM pré-computadas
-- =========================================================
CREATE TABLE public.erp_customer_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  erp_customer_id uuid NOT NULL REFERENCES public.erp_customers(id) ON DELETE CASCADE,
  -- RFM
  recency_days integer,                             -- dias desde a última compra
  frequency_90d integer NOT NULL DEFAULT 0,         -- pedidos nos últimos 90 dias
  frequency_365d integer NOT NULL DEFAULT 0,
  monetary_90d numeric(14,2) NOT NULL DEFAULT 0,
  monetary_365d numeric(14,2) NOT NULL DEFAULT 0,
  avg_ticket numeric(14,2),                          -- ticket médio histórico
  trend_90d numeric(6,4),                            -- variação % vs 90d anteriores
  last_order_at timestamptz,
  rfm_segment text,                                  -- champion | loyal | at_risk | hibernating | lost | new
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, erp_customer_id)
);
CREATE INDEX idx_erp_customer_metrics_org_segment ON public.erp_customer_metrics(organization_id, rfm_segment);
CREATE INDEX idx_erp_customer_metrics_org_monetary ON public.erp_customer_metrics(organization_id, monetary_365d DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_customer_metrics TO authenticated;
GRANT ALL ON public.erp_customer_metrics TO service_role;
ALTER TABLE public.erp_customer_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_customer_metrics org members read" ON public.erp_customer_metrics
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "erp_customer_metrics service writes" ON public.erp_customer_metrics
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- =========================================================
-- 5) erp_product_catalog_lite — apenas SKU + nome + categoria para mix
-- SEM estoque, SEM preço de custo, SEM fiscal.
-- =========================================================
CREATE TABLE public.erp_product_catalog_lite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.erp_integrations(id) ON DELETE SET NULL,
  external_id text NOT NULL,
  sku text,
  name text NOT NULL,
  category text,
  brand text,
  is_active boolean NOT NULL DEFAULT true,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, integration_id, external_id)
);
CREATE INDEX idx_erp_product_catalog_org_category ON public.erp_product_catalog_lite(organization_id, category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_product_catalog_lite TO authenticated;
GRANT ALL ON public.erp_product_catalog_lite TO service_role;
ALTER TABLE public.erp_product_catalog_lite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_product_catalog_lite org members read" ON public.erp_product_catalog_lite
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "erp_product_catalog_lite org admins write" ON public.erp_product_catalog_lite
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER trg_erp_product_catalog_lite_updated_at
  BEFORE UPDATE ON public.erp_product_catalog_lite
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
