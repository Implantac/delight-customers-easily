-- Invites table for org workspace invitations
CREATE TABLE public.org_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  email text NOT NULL,
  role public.org_role NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_invites_org ON public.org_invites(organization_id);
CREATE INDEX idx_org_invites_email ON public.org_invites(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invites TO authenticated;
GRANT ALL ON public.org_invites TO service_role;

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- Admins/owners of the org can manage invites
CREATE POLICY "invites_admin_manage" ON public.org_invites
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role]));

-- Invitee (matching email) can view their pending invite
CREATE POLICY "invites_invitee_select" ON public.org_invites
  FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- Function: accept invite by token (creates membership)
CREATE OR REPLACE FUNCTION public.accept_org_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.org_invites%ROWTYPE;
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO inv FROM public.org_invites
   WHERE token = _token AND accepted_at IS NULL AND expires_at > now()
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite inválido ou expirado'; END IF;
  IF lower(inv.email) <> lower(user_email) THEN
    RAISE EXCEPTION 'Convite é para outro email';
  END IF;

  INSERT INTO public.memberships (organization_id, user_id, role)
  VALUES (inv.organization_id, auth.uid(), inv.role)
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  UPDATE public.org_invites SET accepted_at = now() WHERE id = inv.id;
  UPDATE public.profiles SET current_organization_id = inv.organization_id WHERE id = auth.uid();

  RETURN inv.organization_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_org_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_org_invite(text) TO authenticated;

-- Unique membership per (org, user)
DO $$ BEGIN
  ALTER TABLE public.memberships ADD CONSTRAINT memberships_org_user_unique UNIQUE (organization_id, user_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;