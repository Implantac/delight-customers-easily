
ALTER TABLE public.erp_integrations
  ADD COLUMN IF NOT EXISTS credentials_enc text,
  ADD COLUMN IF NOT EXISTS credentials_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS conflict_strategy text NOT NULL DEFAULT 'erp_wins';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_integrations_conflict_strategy_check') THEN
    ALTER TABLE public.erp_integrations
      ADD CONSTRAINT erp_integrations_conflict_strategy_check
      CHECK (conflict_strategy IN ('erp_wins','crm_wins','last_write_wins','manual'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.erp_local_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  pairing_code text NOT NULL UNIQUE,
  agent_token_hash text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','online','offline','revoked')),
  last_seen_at timestamptz,
  version text,
  os text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erp_local_agents_org_idx ON public.erp_local_agents(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_local_agents TO authenticated;
GRANT ALL ON public.erp_local_agents TO service_role;
ALTER TABLE public.erp_local_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read agents" ON public.erp_local_agents FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "admins manage agents" ON public.erp_local_agents FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE TRIGGER trg_erp_local_agents_updated
  BEFORE UPDATE ON public.erp_local_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.erp_diagnostic_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.erp_integrations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erp_diag_msgs_int_idx ON public.erp_diagnostic_messages(integration_id, created_at);
GRANT SELECT, INSERT ON public.erp_diagnostic_messages TO authenticated;
GRANT ALL ON public.erp_diagnostic_messages TO service_role;
ALTER TABLE public.erp_diagnostic_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read diag" ON public.erp_diagnostic_messages FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members write diag" ON public.erp_diagnostic_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
