
-- WhatsApp multi-atendimento: conversas externas (cliente <-> rep) com SLA
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  assigned_to uuid,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  first_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_customer_message_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wac_org_status ON public.whatsapp_conversations(organization_id, status, last_message_at DESC);
CREATE INDEX idx_wac_assigned ON public.whatsapp_conversations(organization_id, assigned_to, status);
CREATE INDEX idx_wac_phone ON public.whatsapp_conversations(organization_id, contact_phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read wa conv" ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert wa conv" ON public.whatsapp_conversations FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, auth.uid()));
CREATE POLICY "members update wa conv" ON public.whatsapp_conversations FOR UPDATE TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));
CREATE POLICY "admins delete wa conv" ON public.whatsapp_conversations FOR DELETE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), ARRAY['admin'::org_role,'owner'::org_role]));

CREATE TRIGGER update_wac_updated_at BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Mensagens
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  body text NOT NULL,
  sender_user_id uuid,
  attachment_url text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wam_conv ON public.whatsapp_messages(conversation_id, created_at DESC);
CREATE INDEX idx_wam_org ON public.whatsapp_messages(organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read wa msg" ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert wa msg" ON public.whatsapp_messages FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, auth.uid()));
CREATE POLICY "members update wa msg" ON public.whatsapp_messages FOR UPDATE TO authenticated
  USING (is_org_member(organization_id, auth.uid()));

-- Trigger: ao inserir mensagem, atualizar conversa (last_message_at, first_response_at, unread)
CREATE OR REPLACE FUNCTION public.bump_wa_conversation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direction = 'in' THEN
    UPDATE public.whatsapp_conversations
    SET last_message_at = NEW.created_at,
        last_customer_message_at = NEW.created_at,
        unread_count = unread_count + 1,
        status = CASE WHEN status = 'resolved' THEN 'open' ELSE status END
    WHERE id = NEW.conversation_id;
  ELSE
    UPDATE public.whatsapp_conversations
    SET last_message_at = NEW.created_at,
        first_response_at = COALESCE(first_response_at, NEW.created_at),
        unread_count = 0
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_bump_wa_conv AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_wa_conversation();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
