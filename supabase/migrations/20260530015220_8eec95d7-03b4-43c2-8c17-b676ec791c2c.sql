
CREATE TABLE public.referral_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL DEFAULT 'fixed',
  reward_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  reward_currency TEXT NOT NULL DEFAULT 'BRL',
  status TEXT NOT NULL DEFAULT 'active',
  starts_at DATE,
  ends_at DATE,
  terms TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_programs TO authenticated;
GRANT ALL ON public.referral_programs TO service_role;
ALTER TABLE public.referral_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view programs" ON public.referral_programs FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers insert programs" ON public.referral_programs FOR INSERT TO authenticated
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "managers update programs" ON public.referral_programs FOR UPDATE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]))
WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "managers delete programs" ON public.referral_programs FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

CREATE TRIGGER trg_referral_programs_updated BEFORE UPDATE ON public.referral_programs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_referral_programs_org ON public.referral_programs(organization_id, status);

CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  program_id UUID REFERENCES public.referral_programs(id) ON DELETE SET NULL,
  referrer_contact_id UUID,
  referrer_user_id UUID,
  referrer_name TEXT,
  referrer_email TEXT,
  referred_name TEXT NOT NULL,
  referred_email TEXT,
  referred_phone TEXT,
  referred_company TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  deal_id UUID,
  deal_value NUMERIC(12,2),
  reward_amount NUMERIC(12,2),
  reward_paid_at TIMESTAMPTZ,
  qualified_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  rejected_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view referrals" ON public.referrals FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert referrals" ON public.referrals FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members update referrals" ON public.referrals FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers delete referrals" ON public.referrals FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

CREATE TRIGGER trg_referrals_updated BEFORE UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_referrals_org_status ON public.referrals(organization_id, status, created_at DESC);
CREATE INDEX idx_referrals_program ON public.referrals(program_id);
