
-- Add location fields to companies for geo intelligence
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE INDEX IF NOT EXISTS companies_geo_idx
  ON public.companies (organization_id, state, city);

-- Marketing leads: unified inbound from channels (WhatsApp, IG, FB, Google, LP...)
CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel text NOT NULL,           -- whatsapp | instagram | facebook | tiktok | linkedin | google_business | landing_page | influencer
  source text,                     -- campaign / page / influencer slug
  name text,
  phone text,
  email text,
  message text,
  city text,
  state text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new',  -- new | qualified | converted | discarded
  converted_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  converted_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_leads_org_idx ON public.marketing_leads (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_leads_channel_idx ON public.marketing_leads (organization_id, channel);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_leads TO authenticated;
GRANT ALL ON public.marketing_leads TO service_role;

ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_leads_org_access" ON public.marketing_leads
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER marketing_leads_updated
  BEFORE UPDATE ON public.marketing_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Influencers: track partners + links/coupons + ROI
CREATE TABLE IF NOT EXISTS public.influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  handle text,
  platform text,                  -- instagram | tiktok | youtube | linkedin | other
  slug text NOT NULL,             -- usado em link/cupom exclusivo
  coupon_code text,
  commission_pct numeric(5,2) DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS influencers_org_idx ON public.influencers (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencers TO authenticated;
GRANT ALL ON public.influencers TO service_role;

ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "influencers_org_access" ON public.influencers
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TRIGGER influencers_updated
  BEFORE UPDATE ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
