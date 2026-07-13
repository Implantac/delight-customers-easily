-- proposal_items: add WITH CHECK to prevent cross-tenant relinking
DROP POLICY IF EXISTS "members update proposal_items" ON public.proposal_items;
CREATE POLICY "members update proposal_items" ON public.proposal_items
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- quote_items: add WITH CHECK
DROP POLICY IF EXISTS "quote_items_update" ON public.quote_items;
CREATE POLICY "quote_items_update" ON public.quote_items
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- whatsapp_messages: add WITH CHECK
DROP POLICY IF EXISTS "members update wa msg" ON public.whatsapp_messages;
CREATE POLICY "members update wa msg" ON public.whatsapp_messages
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- commercial_automations: align role checks with owner/admin only (consistent with DELETE policy)
DROP POLICY IF EXISTS "commercial_automations_insert" ON public.commercial_automations;
DROP POLICY IF EXISTS "commercial_automations_update" ON public.commercial_automations;

CREATE POLICY "commercial_automations_insert" ON public.commercial_automations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE POLICY "commercial_automations_update" ON public.commercial_automations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
