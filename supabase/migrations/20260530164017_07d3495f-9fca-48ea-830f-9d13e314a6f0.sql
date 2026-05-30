
-- ============================================================
-- A) WhatsApp SLA Policies + tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Padrão',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  first_response_minutes INTEGER NOT NULL DEFAULT 15,
  resolution_minutes INTEGER NOT NULL DEFAULT 240,
  business_hours_only BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, priority)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_sla_policies TO authenticated;
GRANT ALL ON public.whatsapp_sla_policies TO service_role;
ALTER TABLE public.whatsapp_sla_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_sla_org_access" ON public.whatsapp_sla_policies
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_wa_sla_org ON public.whatsapp_sla_policies(organization_id);

-- Coluna de SLA breach em conversas (calculada via job; campo cache)
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_wac_sla_due
  ON public.whatsapp_conversations(organization_id, status, sla_due_at)
  WHERE status <> 'resolved';

-- ============================================================
-- C) Influencer tracking (visits + conversions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.influencer_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  visitor_id TEXT,
  referer TEXT,
  user_agent TEXT,
  utm_source TEXT,
  utm_campaign TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.influencer_visits TO authenticated;
GRANT ALL ON public.influencer_visits TO service_role;
ALTER TABLE public.influencer_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inf_visits_org_read" ON public.influencer_visits
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_inf_visits_org_inf_created
  ON public.influencer_visits(organization_id, influencer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.influencer_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('lead','deal','order')),
  ref_id UUID,
  value NUMERIC(14,2) NOT NULL DEFAULT 0,
  commission NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencer_conversions TO authenticated;
GRANT ALL ON public.influencer_conversions TO service_role;
ALTER TABLE public.influencer_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inf_conv_org_access" ON public.influencer_conversions
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS idx_inf_conv_org_inf
  ON public.influencer_conversions(organization_id, influencer_id, created_at DESC);
