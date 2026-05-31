-- #7 pgvector: enable extension + customer embeddings storage for propensity/churn analytics
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.customer_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  erp_customer_id uuid NOT NULL REFERENCES public.erp_customers(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  source_text text NOT NULL,
  model text NOT NULL DEFAULT 'openai/text-embedding-3-small',
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, erp_customer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_embeddings TO authenticated;
GRANT ALL ON public.customer_embeddings TO service_role;

ALTER TABLE public.customer_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_embeddings read members"
  ON public.customer_embeddings FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "customer_embeddings write owner/admin"
  ON public.customer_embeddings FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE INDEX IF NOT EXISTS customer_embeddings_org_idx ON public.customer_embeddings(organization_id);
CREATE INDEX IF NOT EXISTS customer_embeddings_hnsw_idx
  ON public.customer_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TRIGGER trg_customer_embeddings_updated_at
  BEFORE UPDATE ON public.customer_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RPC: encontra clientes mais similares (para propensão/recomendação)
CREATE OR REPLACE FUNCTION public.match_similar_customers(
  _org uuid,
  _query_embedding vector(1536),
  _limit int DEFAULT 10
)
RETURNS TABLE (erp_customer_id uuid, similarity float)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(_org, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
  SELECT ce.erp_customer_id, 1 - (ce.embedding <=> _query_embedding) AS similarity
  FROM public.customer_embeddings ce
  WHERE ce.organization_id = _org
  ORDER BY ce.embedding <=> _query_embedding
  LIMIT _limit;
END $$;
