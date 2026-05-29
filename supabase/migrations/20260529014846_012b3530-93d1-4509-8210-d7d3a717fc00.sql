-- ============ ENUM ============
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;

CREATE INDEX idx_memberships_user ON public.memberships(user_id);
CREATE INDEX idx_memberships_org ON public.memberships(organization_id);

-- ============ HELPERS (SECURITY DEFINER) ============
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships WHERE organization_id = _org AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _user uuid, _roles public.org_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = _org AND user_id = _user AND role = ANY(_roles)
  );
$$;

-- ============ PROFILES: current org ============
ALTER TABLE public.profiles ADD COLUMN current_organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- ============ ADD organization_id TO DATA TABLES ============
ALTER TABLE public.companies  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.contacts   ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.deals      ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.activities ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ============ BACKFILL: one org per existing user ============
DO $$
DECLARE
  u RECORD;
  new_org_id uuid;
  base_slug text;
  final_slug text;
  i int;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM (
    SELECT user_id FROM public.companies
    UNION SELECT user_id FROM public.contacts
    UNION SELECT user_id FROM public.deals
    UNION SELECT user_id FROM public.activities
    UNION SELECT id AS user_id FROM public.profiles
  ) s WHERE user_id IS NOT NULL
  LOOP
    base_slug := 'ws-' || substr(u.user_id::text, 1, 8);
    final_slug := base_slug;
    i := 1;
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
      i := i + 1;
      final_slug := base_slug || '-' || i;
    END LOOP;

    INSERT INTO public.organizations (name, slug, created_by)
    VALUES ('Meu workspace', final_slug, u.user_id)
    RETURNING id INTO new_org_id;

    INSERT INTO public.memberships (organization_id, user_id, role)
    VALUES (new_org_id, u.user_id, 'owner');

    UPDATE public.companies  SET organization_id = new_org_id WHERE user_id = u.user_id;
    UPDATE public.contacts   SET organization_id = new_org_id WHERE user_id = u.user_id;
    UPDATE public.deals      SET organization_id = new_org_id WHERE user_id = u.user_id;
    UPDATE public.activities SET organization_id = new_org_id WHERE user_id = u.user_id;
    UPDATE public.profiles   SET current_organization_id = new_org_id WHERE id = u.user_id;
  END LOOP;
END $$;

-- ============ MAKE organization_id NOT NULL ============
ALTER TABLE public.companies  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.contacts   ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.deals      ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.activities ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX idx_companies_org  ON public.companies(organization_id);
CREATE INDEX idx_contacts_org   ON public.contacts(organization_id);
CREATE INDEX idx_deals_org      ON public.deals(organization_id);
CREATE INDEX idx_activities_org ON public.activities(organization_id);

-- ============ DROP OLD POLICIES ============
DROP POLICY IF EXISTS companies_all_own  ON public.companies;
DROP POLICY IF EXISTS contacts_all_own   ON public.contacts;
DROP POLICY IF EXISTS deals_all_own      ON public.deals;
DROP POLICY IF EXISTS activities_all_own ON public.activities;

-- ============ NEW POLICIES: scope by org membership ============
CREATE POLICY companies_org_access ON public.companies FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY contacts_org_access ON public.contacts FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY deals_org_access ON public.deals FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY activities_org_access ON public.activities FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- ============ ORGANIZATIONS RLS ============
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY orgs_select_member ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));

CREATE POLICY orgs_insert_self ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY orgs_update_admin ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::public.org_role[]))
  WITH CHECK (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY orgs_delete_owner ON public.organizations FOR DELETE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner']::public.org_role[]));

-- ============ MEMBERSHIPS RLS ============
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY memberships_select_member ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(organization_id, auth.uid()));

CREATE POLICY memberships_insert_self_or_admin ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[])
  );

CREATE POLICY memberships_update_admin ON public.memberships FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY memberships_delete_admin_or_self ON public.memberships FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[])
  );

-- ============ TRIGGERS ============
CREATE TRIGGER set_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ NEW USER HANDLER: auto-create org + membership ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  base_slug text;
  final_slug text;
  i int := 1;
  display_name text;
BEGIN
  display_name := coalesce(new.raw_user_meta_data->>'full_name', new.email);

  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, display_name)
  ON CONFLICT (id) DO NOTHING;

  base_slug := 'ws-' || substr(new.id::text, 1, 8);
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    i := i + 1;
    final_slug := base_slug || '-' || i;
  END LOOP;

  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (coalesce(display_name, 'Meu workspace'), final_slug, new.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.memberships (organization_id, user_id, role)
  VALUES (new_org_id, new.id, 'owner');

  UPDATE public.profiles SET current_organization_id = new_org_id WHERE id = new.id;

  RETURN new;
END;
$$;

-- Ensure the trigger is attached on auth.users (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();