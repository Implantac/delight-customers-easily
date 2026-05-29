SELECT cron.schedule(
  'lovable-generate-alerts-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--06d45a46-46ff-4225-9d53-858f03173986.lovable.app/api/public/hooks/generate-alerts',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indvamt3bGd3bWxscnJpbGJvcWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMTI0NzgsImV4cCI6MjA5NTU4ODQ3OH0.q2BrTja4vQ7CBZK6X0Hpm7EoMCxG9tohzzjjGubQ1ms"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);