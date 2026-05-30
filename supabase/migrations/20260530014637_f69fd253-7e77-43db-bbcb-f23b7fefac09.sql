
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preheader TEXT,
  from_name TEXT NOT NULL DEFAULT 'CRM',
  from_email TEXT NOT NULL,
  reply_to TEXT,
  body_html TEXT NOT NULL DEFAULT '',
  body_text TEXT,
  segment_id UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_delivered INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,
  total_clicked INTEGER NOT NULL DEFAULT 0,
  total_bounced INTEGER NOT NULL DEFAULT 0,
  total_unsubscribed INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaigns TO authenticated;
GRANT ALL ON public.email_campaigns TO service_role;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view campaigns" ON public.email_campaigns FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert campaigns" ON public.email_campaigns FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members update campaigns" ON public.email_campaigns FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "managers delete campaigns" ON public.email_campaigns FOR DELETE TO authenticated
USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

CREATE TRIGGER trg_email_campaigns_updated BEFORE UPDATE ON public.email_campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_email_campaigns_org ON public.email_campaigns(organization_id, status, scheduled_at DESC);

CREATE TABLE public.email_campaign_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  contact_id UUID,
  email TEXT NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_campaign_recipients TO authenticated;
GRANT ALL ON public.email_campaign_recipients TO service_role;
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view recipients" ON public.email_campaign_recipients FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert recipients" ON public.email_campaign_recipients FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members update recipients" ON public.email_campaign_recipients FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()))
WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members delete recipients" ON public.email_campaign_recipients FOR DELETE TO authenticated
USING (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_campaign_recipients_campaign ON public.email_campaign_recipients(campaign_id, status);
CREATE INDEX idx_campaign_recipients_org ON public.email_campaign_recipients(organization_id);
