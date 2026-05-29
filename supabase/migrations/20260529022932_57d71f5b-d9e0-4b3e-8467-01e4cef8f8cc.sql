
-- Custom fields definitions per organization
CREATE TYPE public.custom_field_entity AS ENUM ('contact','company','deal');
CREATE TYPE public.custom_field_kind AS ENUM ('text','number','date','select','boolean');

CREATE TABLE public.custom_field_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  entity public.custom_field_entity NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  kind public.custom_field_kind NOT NULL DEFAULT 'text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, entity, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_field_defs TO authenticated;
GRANT ALL ON public.custom_field_defs TO service_role;
ALTER TABLE public.custom_field_defs ENABLE ROW LEVEL SECURITY;

CREATE POLICY cfd_select ON public.custom_field_defs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY cfd_write ON public.custom_field_defs FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role,'admin'::org_role]));

CREATE TRIGGER cfd_updated BEFORE UPDATE ON public.custom_field_defs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add custom_values JSONB to existing tables
ALTER TABLE public.contacts ADD COLUMN custom_values jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN custom_values jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.deals ADD COLUMN custom_values jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_select_own ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notif_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY notif_insert_org ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX notif_user_unread ON public.notifications (user_id, read_at, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
