-- LGPD consent em lead_form_submissions
ALTER TABLE public.lead_form_submissions
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_text text,
  ADD COLUMN IF NOT EXISTS consent_ip text;

-- Rastreamento do último passo de email despachado por inscrição em sequência
ALTER TABLE public.sequence_enrollments
  ADD COLUMN IF NOT EXISTS last_dispatched_step int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dispatched_at timestamptz;

-- Geo: rastrear data da última geocodificação automática
ALTER TABLE public.geo_locations
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_source text;

-- Registro de consentimento LGPD genérico (cookies / banner)
CREATE TABLE IF NOT EXISTS public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  subject_type text NOT NULL,
  subject_id text,
  purpose text NOT NULL,
  consent_text text NOT NULL,
  granted boolean NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.consent_log TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_log TO authenticated;
GRANT ALL ON public.consent_log TO service_role;

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can insert own consent"
  ON public.consent_log FOR INSERT TO anon
  WITH CHECK (organization_id IS NULL AND user_id IS NULL);

CREATE POLICY "auth can insert own consent"
  ON public.consent_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "members read org consent"
  ON public.consent_log FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()))
  );

CREATE INDEX IF NOT EXISTS idx_consent_log_user ON public.consent_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_log_org ON public.consent_log(organization_id, created_at DESC);
