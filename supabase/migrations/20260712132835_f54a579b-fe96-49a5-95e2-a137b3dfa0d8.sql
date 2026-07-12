
ALTER TABLE public.sequence_enrollments
  ADD COLUMN IF NOT EXISTS paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.pause_sequences_on_wa_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact uuid;
BEGIN
  IF NEW.direction <> 'in' THEN
    RETURN NEW;
  END IF;
  SELECT contact_id INTO v_contact FROM public.whatsapp_conversations WHERE id = NEW.conversation_id;
  IF v_contact IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.sequence_enrollments
     SET status = 'paused',
         paused_reason = 'Resposta recebida por WhatsApp',
         paused_at = now()
   WHERE contact_id = v_contact
     AND organization_id = NEW.organization_id
     AND status = 'active';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pause_sequences_on_wa_reply ON public.whatsapp_messages;
CREATE TRIGGER trg_pause_sequences_on_wa_reply
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.pause_sequences_on_wa_reply();
