
-- 1) Theme preference per user
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'system'
    CHECK (theme_preference IN ('light','dark','system'));

-- 2) Influencer landing page fields
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS cta_text text,
  ADD COLUMN IF NOT EXISTS cta_url text,
  ADD COLUMN IF NOT EXISTS lp_enabled boolean NOT NULL DEFAULT false;

-- 3) ERP agent tokens (for desktop agent push)
CREATE TABLE IF NOT EXISTS public.erp_agent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS erp_agent_tokens_org_idx ON public.erp_agent_tokens (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_agent_tokens TO authenticated;
GRANT ALL ON public.erp_agent_tokens TO service_role;

ALTER TABLE public.erp_agent_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_agent_tokens_admin_only" ON public.erp_agent_tokens
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- 4) Public RPC to read enabled influencer landing page
CREATE OR REPLACE FUNCTION public.get_influencer_lp(_org_slug text, _inf_slug text)
RETURNS TABLE (
  organization_name text,
  name text,
  handle text,
  platform text,
  slug text,
  coupon_code text,
  headline text,
  bio text,
  hero_image_url text,
  cta_text text,
  cta_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.name, i.name, i.handle, i.platform, i.slug, i.coupon_code,
         i.headline, i.bio, i.hero_image_url, i.cta_text, i.cta_url
  FROM public.influencers i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE o.slug = _org_slug
    AND lower(i.slug) = lower(_inf_slug)
    AND i.is_active = true
    AND i.lp_enabled = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_influencer_lp(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_influencer_lp(text, text) TO anon, authenticated;
