-- Threads
CREATE TABLE public.ai_copilot_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Nova conversa',
  context_type text,
  context_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_copilot_threads_org_user_idx ON public.ai_copilot_threads(organization_id, user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_copilot_threads TO authenticated;
GRANT ALL ON public.ai_copilot_threads TO service_role;
ALTER TABLE public.ai_copilot_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thread members read" ON public.ai_copilot_threads FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "thread members write" ON public.ai_copilot_threads FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "thread members update" ON public.ai_copilot_threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "thread members delete" ON public.ai_copilot_threads FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE TRIGGER ai_copilot_threads_uat BEFORE UPDATE ON public.ai_copilot_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Messages
CREATE TABLE public.ai_copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.ai_copilot_threads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL,
  tokens_in int,
  tokens_out int,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_copilot_messages_thread_idx ON public.ai_copilot_messages(thread_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.ai_copilot_messages TO authenticated;
GRANT ALL ON public.ai_copilot_messages TO service_role;
ALTER TABLE public.ai_copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg via thread read" ON public.ai_copilot_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_copilot_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "msg via thread write" ON public.ai_copilot_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_copilot_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "msg via thread delete" ON public.ai_copilot_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_copilot_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));

-- Deal insights (TTL)
CREATE TABLE public.ai_deal_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  summary text,
  risk_level text CHECK (risk_level IN ('low','medium','high')),
  risk_reason text,
  next_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  win_probability numeric(5,2),
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (deal_id)
);
CREATE INDEX ai_deal_insights_org_idx ON public.ai_deal_insights(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_deal_insights TO authenticated;
GRANT ALL ON public.ai_deal_insights TO service_role;
ALTER TABLE public.ai_deal_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insights members" ON public.ai_deal_insights FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- Email drafts
CREATE TABLE public.ai_email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  contact_id uuid,
  purpose text,
  tone text,
  subject text,
  body text NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_email_drafts_org_idx ON public.ai_email_drafts(organization_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_email_drafts TO authenticated;
GRANT ALL ON public.ai_email_drafts TO service_role;
ALTER TABLE public.ai_email_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drafts members read" ON public.ai_email_drafts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "drafts owner write" ON public.ai_email_drafts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND user_id = auth.uid());
CREATE POLICY "drafts owner update" ON public.ai_email_drafts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "drafts owner delete" ON public.ai_email_drafts FOR DELETE TO authenticated
  USING (user_id = auth.uid());