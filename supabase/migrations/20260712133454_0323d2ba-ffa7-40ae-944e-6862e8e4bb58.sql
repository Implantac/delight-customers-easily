
-- proposal_items
DROP POLICY IF EXISTS "members update proposal_items" ON public.proposal_items;
CREATE POLICY "members update proposal_items" ON public.proposal_items
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- quote_items
DROP POLICY IF EXISTS "quote_items_update" ON public.quote_items;
CREATE POLICY "quote_items_update" ON public.quote_items
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- whatsapp_messages
DROP POLICY IF EXISTS "members update wa msg" ON public.whatsapp_messages;
CREATE POLICY "members update wa msg" ON public.whatsapp_messages
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
