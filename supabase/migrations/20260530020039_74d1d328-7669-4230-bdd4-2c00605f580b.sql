CREATE TABLE public.document_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  parent_id UUID REFERENCES public.document_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  folder_id UUID REFERENCES public.document_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  tags TEXT[] NOT NULL DEFAULT '{}',
  company_id UUID,
  contact_id UUID,
  deal_id UUID,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  version INT NOT NULL,
  url TEXT NOT NULL,
  size_bytes BIGINT DEFAULT 0,
  notes TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_folders_org ON public.document_folders(organization_id);
CREATE INDEX idx_documents_org ON public.documents(organization_id);
CREATE INDEX idx_documents_folder ON public.documents(folder_id);
CREATE INDEX idx_doc_versions_doc ON public.document_versions(document_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_folders TO authenticated;
GRANT ALL ON public.document_folders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_versions TO authenticated;
GRANT ALL ON public.document_versions TO service_role;

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_folders_member_all" ON public.document_folders
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "documents_member_all" ON public.documents
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "doc_versions_member_select" ON public.document_versions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "doc_versions_member_insert" ON public.document_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "doc_versions_admin_delete" ON public.document_versions
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));

CREATE TRIGGER trg_doc_folders_updated_at BEFORE UPDATE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();