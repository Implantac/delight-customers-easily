
-- Provedores suportados
DO $$ BEGIN
  CREATE TYPE public.wa_provider AS ENUM ('meta_waba','evolution','uazapi','twilio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wa_channel_status AS ENUM ('draft','active','paused','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wa_outbox_status AS ENUM ('pending','sending','sent','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Canais (configuração por org)
CREATE TABLE IF NOT EXISTS public.whatsapp_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider public.wa_provider NOT NULL,
  display_name TEXT NOT NULL,
  phone_number TEXT,
  phone_number_id TEXT,
  business_account_id TEXT,
  webhook_secret TEXT,
  base_url TEXT,
  instance_name TEXT,
  credentials_encrypted TEXT,
  status public.wa_channel_status NOT NULL DEFAULT 'draft',
  last_error TEXT,
  last_health_check_at TIMESTAMPTZ,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_channels_org ON public.whatsapp_channels(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_channels TO authenticated;
GRANT ALL ON public.whatsapp_channels TO service_role;
ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_channels_member_select" ON public.whatsapp_channels FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = whatsapp_channels.organization_id AND m.user_id = auth.uid()));
CREATE POLICY "wa_channels_admin_write" ON public.whatsapp_channels FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = whatsapp_channels.organization_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = whatsapp_channels.organization_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')));

-- Outbox: mensagens a enviar
CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.whatsapp_channels(id) ON DELETE CASCADE,
  conversation_id UUID,
  message_id UUID,
  to_phone TEXT NOT NULL,
  body TEXT NOT NULL,
  template_name TEXT,
  template_variables JSONB,
  status public.wa_outbox_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  provider_message_id TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_outbox_status ON public.whatsapp_outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_wa_outbox_org ON public.whatsapp_outbox(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_outbox TO authenticated;
GRANT ALL ON public.whatsapp_outbox TO service_role;
ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_outbox_member_select" ON public.whatsapp_outbox FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.organization_id = whatsapp_outbox.organization_id AND m.user_id = auth.uid()));

-- Eventos inbound (webhooks)
CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
  provider public.wa_provider NOT NULL,
  event_type TEXT,
  payload JSONB NOT NULL,
  signature TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  process_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_inbound_channel ON public.whatsapp_inbound_events(channel_id, received_at DESC);
GRANT SELECT ON public.whatsapp_inbound_events TO authenticated;
GRANT ALL ON public.whatsapp_inbound_events TO service_role;
ALTER TABLE public.whatsapp_inbound_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_inbound_admin_select" ON public.whatsapp_inbound_events FOR SELECT TO authenticated
USING (channel_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.whatsapp_channels c
  JOIN public.memberships m ON m.organization_id = c.organization_id
  WHERE c.id = whatsapp_inbound_events.channel_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
));

-- Campos extras em tabelas existentes
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL;
