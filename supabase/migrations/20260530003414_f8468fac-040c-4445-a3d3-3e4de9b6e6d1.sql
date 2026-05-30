CREATE TABLE public.kb_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_kb_articles_org_status ON public.kb_articles(organization_id, status);
CREATE INDEX idx_kb_articles_author ON public.kb_articles(author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_articles TO authenticated;
GRANT ALL ON public.kb_articles TO service_role;

ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kb_articles_select"
  ON public.kb_articles FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (status = 'published' OR author_id = auth.uid()
         OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  );

CREATE POLICY "kb_articles_insert"
  ON public.kb_articles FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND author_id = auth.uid()
  );

CREATE POLICY "kb_articles_update"
  ON public.kb_articles FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (author_id = auth.uid()
         OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  );

CREATE POLICY "kb_articles_delete"
  ON public.kb_articles FOR DELETE TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (author_id = auth.uid()
         OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  );

CREATE TRIGGER kb_articles_updated_at
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();