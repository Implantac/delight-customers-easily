DO $$ BEGIN
  CREATE TYPE public.stock_movement_kind AS ENUM ('in','out','adjust');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  product_id uuid NULL,
  product_name text NOT NULL,
  kind public.stock_movement_kind NOT NULL,
  quantity numeric(14,3) NOT NULL,
  unit_cost numeric(14,2) NOT NULL DEFAULT 0,
  reason text NULL,
  reference text NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_mov_org ON public.stock_movements(organization_id, occurred_at DESC);
CREATE INDEX idx_stock_mov_product ON public.stock_movements(organization_id, product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read stock_movements" ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert stock_movements" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members update stock_movements" ON public.stock_movements FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "admins delete stock_movements" ON public.stock_movements FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));
