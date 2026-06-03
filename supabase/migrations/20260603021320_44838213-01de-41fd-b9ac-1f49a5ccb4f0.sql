
-- ============ site_chat_keys ============
CREATE TABLE public.site_chat_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_key text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT 'Site',
  allowed_origins text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_site_chat_keys_org ON public.site_chat_keys(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_chat_keys TO authenticated;
GRANT ALL ON public.site_chat_keys TO service_role;

ALTER TABLE public.site_chat_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read keys" ON public.site_chat_keys FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = site_chat_keys.organization_id AND m.user_id = auth.uid()));
CREATE POLICY "admins manage keys insert" ON public.site_chat_keys FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = site_chat_keys.organization_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')));
CREATE POLICY "admins manage keys update" ON public.site_chat_keys FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = site_chat_keys.organization_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')));
CREATE POLICY "admins manage keys delete" ON public.site_chat_keys FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = site_chat_keys.organization_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')));

-- ============ site_chat_sessions ============
CREATE TABLE public.site_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_key_id uuid NOT NULL REFERENCES public.site_chat_keys(id) ON DELETE CASCADE,
  visitor_token text NOT NULL UNIQUE,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  page_url text,
  referrer text,
  user_agent text,
  ip_hash text,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  lead_id uuid,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_for_agent int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_site_chat_sessions_org ON public.site_chat_sessions(organization_id, last_message_at DESC);
CREATE INDEX idx_site_chat_sessions_token ON public.site_chat_sessions(visitor_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_chat_sessions TO authenticated;
GRANT ALL ON public.site_chat_sessions TO service_role;

ALTER TABLE public.site_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read sessions" ON public.site_chat_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = site_chat_sessions.organization_id AND m.user_id = auth.uid()));
CREATE POLICY "members update sessions" ON public.site_chat_sessions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = site_chat_sessions.organization_id AND m.user_id = auth.uid()));

-- ============ site_chat_messages ============
CREATE TABLE public.site_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.site_chat_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sender_kind text NOT NULL CHECK (sender_kind IN ('visitor','agent','system')),
  sender_user_id uuid,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_site_chat_messages_session ON public.site_chat_messages(session_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_chat_messages TO authenticated;
GRANT ALL ON public.site_chat_messages TO service_role;

ALTER TABLE public.site_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read messages" ON public.site_chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = site_chat_messages.organization_id AND m.user_id = auth.uid()));
CREATE POLICY "members insert agent messages" ON public.site_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_kind = 'agent'
    AND sender_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = site_chat_messages.organization_id AND m.user_id = auth.uid())
  );
