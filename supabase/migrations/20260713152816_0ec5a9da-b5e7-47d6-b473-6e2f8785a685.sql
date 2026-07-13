
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'skill',
  content text NOT NULL,
  content_hash text NOT NULL,
  embedding vector(1536),
  tokens int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_docs TO authenticated;
GRANT ALL ON public.knowledge_docs TO service_role;

ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_docs_read_authenticated"
ON public.knowledge_docs FOR SELECT
TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS knowledge_docs_embedding_idx
  ON public.knowledge_docs USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_knowledge_docs(
  query_embedding vector(1536),
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  description text,
  kind text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.slug, d.title, d.description, d.kind, d.content,
         1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_docs d
  WHERE d.embedding IS NOT NULL
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge_docs(vector, int) TO authenticated;
