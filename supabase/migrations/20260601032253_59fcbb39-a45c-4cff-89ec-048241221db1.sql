ALTER TABLE public.erp_integrations
  ADD COLUMN IF NOT EXISTS next_sync_at timestamptz;

CREATE INDEX IF NOT EXISTS erp_integrations_next_sync_idx
  ON public.erp_integrations (next_sync_at)
  WHERE sync_cron IS NOT NULL AND is_active = true;