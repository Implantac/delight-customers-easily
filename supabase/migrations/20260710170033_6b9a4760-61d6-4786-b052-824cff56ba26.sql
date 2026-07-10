
-- proposal_items: add WITH CHECK on UPDATE
DROP POLICY IF EXISTS "members update proposal_items" ON public.proposal_items;
CREATE POLICY "members update proposal_items"
  ON public.proposal_items
  FOR UPDATE
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- whatsapp_messages: add WITH CHECK on UPDATE
DROP POLICY IF EXISTS "members update wa msg" ON public.whatsapp_messages;
CREATE POLICY "members update wa msg"
  ON public.whatsapp_messages
  FOR UPDATE
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- commercial_automations: align INSERT/UPDATE to owner/admin only (match DELETE)
DROP POLICY IF EXISTS commercial_automations_insert_admin ON public.commercial_automations;
CREATE POLICY commercial_automations_insert_admin
  ON public.commercial_automations
  FOR INSERT
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role]));

DROP POLICY IF EXISTS commercial_automations_update_admin ON public.commercial_automations;
CREATE POLICY commercial_automations_update_admin
  ON public.commercial_automations
  FOR UPDATE
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner'::org_role, 'admin'::org_role]));
