-- Make intent explicit: whatsapp_outbox is written ONLY by service role.
-- A restrictive policy that returns false for authenticated/anon prevents any
-- future permissive INSERT/UPDATE/DELETE policy from accidentally opening a gap.
CREATE POLICY "wa_outbox_deny_client_writes"
ON public.whatsapp_outbox
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);
