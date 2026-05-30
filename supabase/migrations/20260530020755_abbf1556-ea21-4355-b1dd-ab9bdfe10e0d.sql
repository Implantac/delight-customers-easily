CREATE TABLE public.loyalty_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  balance INT NOT NULL DEFAULT 0,
  total_earned INT NOT NULL DEFAULT 0,
  total_redeemed INT NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, contact_id)
);

CREATE TABLE public.loyalty_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'earn', -- earn | redeem | adjust | expire
  points INT NOT NULL DEFAULT 0,
  reason TEXT,
  reference TEXT,
  reward_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.loyalty_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cost_points INT NOT NULL DEFAULT 0,
  stock INT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_accounts_org ON public.loyalty_accounts(organization_id);
CREATE INDEX idx_loyalty_tx_account ON public.loyalty_transactions(account_id);
CREATE INDEX idx_loyalty_rewards_org ON public.loyalty_rewards(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_accounts TO authenticated;
GRANT ALL ON public.loyalty_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_transactions TO authenticated;
GRANT ALL ON public.loyalty_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_rewards TO authenticated;
GRANT ALL ON public.loyalty_rewards TO service_role;

ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_accounts_member_all" ON public.loyalty_accounts
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "loyalty_tx_member_select" ON public.loyalty_transactions
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "loyalty_tx_member_insert" ON public.loyalty_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "loyalty_tx_admin_delete" ON public.loyalty_transactions
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));

CREATE POLICY "loyalty_rewards_member_select" ON public.loyalty_rewards
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "loyalty_rewards_member_write" ON public.loyalty_rewards
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "loyalty_rewards_member_update" ON public.loyalty_rewards
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "loyalty_rewards_admin_delete" ON public.loyalty_rewards
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin','owner']::org_role[]));

CREATE TRIGGER trg_loyalty_accounts_updated_at BEFORE UPDATE ON public.loyalty_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_loyalty_rewards_updated_at BEFORE UPDATE ON public.loyalty_rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();