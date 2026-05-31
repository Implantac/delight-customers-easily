-- =====================================================================
-- FASE 6 — GEOINTELIGÊNCIA (CRM)
-- =====================================================================

-- ---------- geo_locations ----------
CREATE TABLE public.geo_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('company','contact','erp_customer','lead')),
  subject_id uuid NOT NULL,
  latitude double precision,
  longitude double precision,
  geohash text,
  cep text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  ibge_code text,
  country text DEFAULT 'BR',
  source text DEFAULT 'manual',
  accuracy text,
  geocoded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, subject_type, subject_id)
);

CREATE INDEX idx_geo_locations_org_subject ON public.geo_locations(organization_id, subject_type);
CREATE INDEX idx_geo_locations_state_city ON public.geo_locations(organization_id, state, city);
CREATE INDEX idx_geo_locations_geohash ON public.geo_locations(geohash);
CREATE INDEX idx_geo_locations_latlng ON public.geo_locations(latitude, longitude);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_locations TO authenticated;
GRANT ALL ON public.geo_locations TO service_role;

ALTER TABLE public.geo_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_locations_select" ON public.geo_locations
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "geo_locations_insert" ON public.geo_locations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "geo_locations_update" ON public.geo_locations
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "geo_locations_delete" ON public.geo_locations
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER trg_geo_locations_updated_at
  BEFORE UPDATE ON public.geo_locations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- geo_territories ----------
CREATE TABLE public.geo_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  owner_user_id uuid,
  states text[] DEFAULT '{}',
  cities text[] DEFAULT '{}',
  cep_ranges jsonb DEFAULT '[]'::jsonb,
  polygon_geojson jsonb,
  center_lat double precision,
  center_lng double precision,
  radius_km numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_geo_territories_org ON public.geo_territories(organization_id);
CREATE INDEX idx_geo_territories_owner ON public.geo_territories(owner_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_territories TO authenticated;
GRANT ALL ON public.geo_territories TO service_role;

ALTER TABLE public.geo_territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_territories_select" ON public.geo_territories
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "geo_territories_mutate" ON public.geo_territories
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TRIGGER trg_geo_territories_updated_at
  BEFORE UPDATE ON public.geo_territories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- geo_route_plans ----------
CREATE TABLE public.geo_route_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  plan_date date NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','canceled')),
  start_lat double precision,
  start_lng double precision,
  stops jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_distance_km numeric,
  total_duration_min integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_geo_route_plans_org_date ON public.geo_route_plans(organization_id, plan_date);
CREATE INDEX idx_geo_route_plans_owner ON public.geo_route_plans(owner_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_route_plans TO authenticated;
GRANT ALL ON public.geo_route_plans TO service_role;

ALTER TABLE public.geo_route_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_route_plans_select" ON public.geo_route_plans
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "geo_route_plans_insert" ON public.geo_route_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND owner_user_id = auth.uid()
  );
CREATE POLICY "geo_route_plans_update_own" ON public.geo_route_plans
  FOR UPDATE TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[])
  )
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "geo_route_plans_delete_own" ON public.geo_route_plans
  FOR DELETE TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[])
  );

CREATE TRIGGER trg_geo_route_plans_updated_at
  BEFORE UPDATE ON public.geo_route_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- RPC: find_opportunities_in_radius ----------
-- Fórmula de Haversine (km) para evitar dependência de PostGIS.
CREATE OR REPLACE FUNCTION public.find_opportunities_in_radius(
  _org uuid,
  _lat double precision,
  _lng double precision,
  _radius_km numeric DEFAULT 25,
  _subject_types text[] DEFAULT ARRAY['company','erp_customer','lead']::text[],
  _limit int DEFAULT 100
)
RETURNS TABLE(
  subject_type text,
  subject_id uuid,
  latitude double precision,
  longitude double precision,
  city text,
  state text,
  distance_km numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(_org, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado à organização';
  END IF;

  RETURN QUERY
  SELECT
    g.subject_type,
    g.subject_id,
    g.latitude,
    g.longitude,
    g.city,
    g.state,
    ROUND((
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_lat)) * cos(radians(g.latitude))
          * cos(radians(g.longitude) - radians(_lng))
          + sin(radians(_lat)) * sin(radians(g.latitude))
        ))
      )
    )::numeric, 3) AS distance_km
  FROM public.geo_locations g
  WHERE g.organization_id = _org
    AND g.latitude IS NOT NULL AND g.longitude IS NOT NULL
    AND g.subject_type = ANY(_subject_types)
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_lat)) * cos(radians(g.latitude))
          * cos(radians(g.longitude) - radians(_lng))
          + sin(radians(_lat)) * sin(radians(g.latitude))
        ))
      )
    ) <= _radius_km
  ORDER BY distance_km ASC
  LIMIT _limit;
END $$;

REVOKE EXECUTE ON FUNCTION public.find_opportunities_in_radius(uuid, double precision, double precision, numeric, text[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_opportunities_in_radius(uuid, double precision, double precision, numeric, text[], int) TO authenticated;

-- ---------- RPC: regional analytics rollup ----------
CREATE OR REPLACE FUNCTION public.get_regional_sales_rollup(_org uuid, _days int DEFAULT 90)
RETURNS TABLE(state text, city text, customers bigint, orders bigint, revenue numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(_org, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado à organização';
  END IF;

  RETURN QUERY
  SELECT
    g.state,
    g.city,
    COUNT(DISTINCT g.subject_id)::bigint AS customers,
    COUNT(DISTINCT s.id)::bigint AS orders,
    COALESCE(SUM(s.total_value), 0)::numeric AS revenue
  FROM public.geo_locations g
  LEFT JOIN public.erp_sales_history s
    ON s.organization_id = g.organization_id
   AND s.erp_customer_id = g.subject_id
   AND g.subject_type = 'erp_customer'
   AND s.order_date >= now() - make_interval(days => _days)
  WHERE g.organization_id = _org
    AND g.state IS NOT NULL
  GROUP BY g.state, g.city
  ORDER BY revenue DESC NULLS LAST;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_regional_sales_rollup(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_regional_sales_rollup(uuid, int) TO authenticated;