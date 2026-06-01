DO $$
DECLARE
  v_base text := 'https://project--06d45a46-46ff-4225-9d53-858f03173986.lovable.app';
  v_apikey text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvamt3bGd3bWxscnJpbGJvcWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMTI0NzgsImV4cCI6MjA5NTU4ODQ3OH0.q2BrTja4vQ7CBZK6X0Hpm7EoMCxG9tohzzjjGubQ1ms';
BEGIN
  -- Garante extensões
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  -- Desagenda se já existir (idempotente)
  PERFORM cron.unschedule('campaign-tick-every-minute')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'campaign-tick-every-minute');
  PERFORM cron.unschedule('sequence-tick-every-5min')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sequence-tick-every-5min');

  PERFORM cron.schedule(
    'campaign-tick-every-minute',
    '* * * * *',
    format($f$SELECT net.http_post(
      url := '%s/api/public/hooks/campaign-tick',
      headers := jsonb_build_object('Content-Type','application/json','apikey','%s'),
      body := '{}'::jsonb
    );$f$, v_base, v_apikey)
  );

  PERFORM cron.schedule(
    'sequence-tick-every-5min',
    '*/5 * * * *',
    format($f$SELECT net.http_post(
      url := '%s/api/public/hooks/sequence-tick',
      headers := jsonb_build_object('Content-Type','application/json','apikey','%s'),
      body := '{}'::jsonb
    );$f$, v_base, v_apikey)
  );
END $$;