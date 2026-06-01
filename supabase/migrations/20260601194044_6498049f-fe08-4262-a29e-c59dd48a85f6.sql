-- 1) oauth_states: tabela interna, apenas service_role usa (RLS está on sem policy)
DROP POLICY IF EXISTS oauth_states_no_access ON public.oauth_states;
CREATE POLICY oauth_states_no_access ON public.oauth_states
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

-- 2) Trigger functions: nunca devem ser chamadas via API
REVOKE EXECUTE ON FUNCTION public.bump_conv_last_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_wa_conversation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_deal_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_churn_to_outcomes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_repurchase_to_outcomes() FROM PUBLIC, anon, authenticated;

-- 3) Helpers SECURITY DEFINER: remover acesso anônimo (mantém authenticated p/ uso em RLS)
REVOKE EXECUTE ON FUNCTION public.can_see_all_in_org(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_similar_customers(uuid, vector, integer) FROM anon, PUBLIC;