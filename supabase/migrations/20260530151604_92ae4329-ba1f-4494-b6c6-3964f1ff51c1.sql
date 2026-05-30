
-- 1) Hierarquia de organizações (holding -> filiais)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS parent_org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS organizations_parent_idx
  ON public.organizations(parent_org_id) WHERE parent_org_id IS NOT NULL;

-- Evita ciclos diretos (org não pode ser pai de si mesma)
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_no_self_parent;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_no_self_parent
  CHECK (parent_org_id IS NULL OR parent_org_id <> id);

-- 2) Descendentes (inclui a própria org). Usada por benchmark/consolidado.
CREATE OR REPLACE FUNCTION public.org_descendants(_root uuid)
RETURNS TABLE (organization_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT id FROM public.organizations WHERE id = _root
    UNION ALL
    SELECT o.id FROM public.organizations o
    JOIN tree t ON o.parent_org_id = t.id
  )
  SELECT id FROM tree;
$$;

REVOKE ALL ON FUNCTION public.org_descendants(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_descendants(uuid) TO authenticated;

-- 3) Membro do grupo (helper recursivo) — opt-in para futuras políticas
CREATE OR REPLACE FUNCTION public.is_org_or_descendant_member(_root uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = _user
      AND m.organization_id IN (SELECT organization_id FROM public.org_descendants(_root))
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_or_descendant_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_or_descendant_member(uuid, uuid) TO authenticated;
