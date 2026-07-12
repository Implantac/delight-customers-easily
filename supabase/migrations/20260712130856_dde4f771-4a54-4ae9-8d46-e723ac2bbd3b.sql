-- Fecha alertas do scanner: adiciona WITH CHECK em políticas UPDATE que só tinham USING,
-- evitando que um membro mova linhas entre organizações via UPDATE.

-- proposal_items
DROP POLICY IF EXISTS "members update proposal_items" ON public.proposal_items;
CREATE POLICY "members update proposal_items"
  ON public.proposal_items
  FOR UPDATE
  TO authenticated
  USING (public.is_org_member(
    (SELECT organization_id FROM public.proposals WHERE id = proposal_items.proposal_id),
    auth.uid()
  ))
  WITH CHECK (public.is_org_member(
    (SELECT organization_id FROM public.proposals WHERE id = proposal_items.proposal_id),
    auth.uid()
  ));

-- quote_items
DROP POLICY IF EXISTS "quote_items_update" ON public.quote_items;
CREATE POLICY "quote_items_update"
  ON public.quote_items
  FOR UPDATE
  TO authenticated
  USING (public.is_org_member(
    (SELECT organization_id FROM public.quotes WHERE id = quote_items.quote_id),
    auth.uid()
  ))
  WITH CHECK (public.is_org_member(
    (SELECT organization_id FROM public.quotes WHERE id = quote_items.quote_id),
    auth.uid()
  ));

-- whatsapp_messages
DROP POLICY IF EXISTS "members update wa msg" ON public.whatsapp_messages;
CREATE POLICY "members update wa msg"
  ON public.whatsapp_messages
  FOR UPDATE
  TO authenticated
  USING (public.is_org_member(whatsapp_messages.organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(whatsapp_messages.organization_id, auth.uid()));

-- commercial_automations: alinha DELETE ao mesmo conjunto de papéis usados em INSERT/UPDATE
-- ('owner','admin','manager'), removendo a inconsistência apontada pelo scanner.
DROP POLICY IF EXISTS "commercial_automations_delete" ON public.commercial_automations;
CREATE POLICY "commercial_automations_delete"
  ON public.commercial_automations
  FOR DELETE
  TO authenticated
  USING (public.has_org_role(
    commercial_automations.organization_id,
    auth.uid(),
    ARRAY['owner','admin','manager']::org_role[]
  ));
