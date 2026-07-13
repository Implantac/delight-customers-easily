---
name: crm-security
description: Segurança de CRM enterprise — RBAC, ABAC, RLS multi-tenant, audit, LGPD/GDPR, encryption, tenant isolation, secrets. Ler ao criar/alterar tabelas, políticas, rotas privilegiadas, ou tratar dados sensíveis.
---

# CRM Security

## Multi-tenant isolation (crítico)
- Toda tabela `public` com dados de cliente TEM `organization_id NOT NULL` + FK para `organizations`
- RLS **enable** obrigatório
- Políticas usam `is_org_member(_org, auth.uid())` (SECURITY DEFINER, evita recursão)
- GRANTs explícitos (ver `public-schema-grants`) — sem GRANT, tabela é invisível

## RBAC (já implementado)
- Enum `org_role`: owner, admin, manager, member
- Tabela `memberships` (nunca colocar role em `profiles`)
- Funções `has_org_role`, `can_see_all_in_org` para checagem em policies

## ABAC (attribute-based)
Quando RBAC não basta:
- **Territory** — rep vê só contas do seu território
- **Named account** — deal só visível ao owner + gestores
- **Confidencial** — flag `is_confidential` filtra além do RBAC
- Combinar em policy: `USING (is_org_member(...) AND (owner_id = auth.uid() OR has_org_role(..., ARRAY['manager','admin','owner'])))`

## Regra do WITH CHECK (importante — findings atuais)
Toda policy UPDATE deve ter **WITH CHECK matching USING** para impedir "relinking" (mudar owner_id/user_id para outro usuário via update).
Padrão correto:
```sql
CREATE POLICY x_update ON t
FOR UPDATE
USING (is_owner_or_admin(...))
WITH CHECK (is_owner_or_admin(...));  -- MESMA condição, não só is_org_member
```

## LGPD / GDPR
- **Consentimento** rastreado (`consent_log`)
- **Direito ao esquecimento**: rotina de anonimização (não delete cascade cego)
- **Portabilidade**: export por titular
- **Base legal** documentada por tipo de dado
- **DPO** identificado em `organizations` (opcional)
- **Retenção** configurável (`briefing_preferences`)

Não coletar dado sensível sem finalidade explícita (nunca CPF sem justificativa comercial).

## Audit log
`audit_log` grava CREATE/UPDATE/DELETE via trigger `log_entity_change`.
Guarda: quem, quando, o quê, mudanças (diff).
Nunca purgar sem retenção mínima legal.

## Encryption
- **In transit**: HTTPS obrigatório (Supabase já)
- **At rest**: Supabase criptografa disco
- **Secrets**: via connectors ou `add_secret` tool, nunca em `.env` público
- **PII sensível** (CPF, cartão) — nunca armazenar sem necessidade; se necessário, campo cifrado (pgp_sym_encrypt) + acesso restrito

## Autenticação
- Supabase Auth com email/senha + Google OAuth
- **MFA** disponível (`/settings/security`)
- **Session timeout** configurável
- **Password policy** mínima 8 chars + complexidade

## Chaves e segredos
- `SUPABASE_SERVICE_ROLE_KEY` só em `.server.ts`, nunca no client bundle
- `LOVABLE_API_KEY` server-side apenas
- Rotação periódica de secrets externos
- Connector secrets via padrão `standard_connectors` (nunca hardcode)

## Rate limiting & abuse
- Rate limit em `/api/public/*` (assinatura HMAC ou token)
- Captcha em formulários públicos (`lead_forms`)
- Bloqueio de IP repetido em `oauth_states` inválidos

## Public endpoints (webhooks, chat, lead forms)
Sob `/api/public/*` — auth bypass no site publicado. **Sempre** verificar:
- Assinatura HMAC (webhooks)
- Rate limit
- Validação Zod dos inputs
- Nenhum PII no response além do estritamente necessário

## Auditoria e compliance
- Log de acesso a dados sensíveis
- Report de acesso por usuário/período (para DPO)
- Detecção de anomalia (rep exportando lista inteira, muitas queries fora do horário)

## Antipatterns
- Role em `profiles` (privilege escalation via update)
- Policy UPDATE sem WITH CHECK (relinking)
- `SELECT *` cross-org via `supabaseAdmin` sem checagem
- Server function sem `requireSupabaseAuth` para dados privados
- Secret em `.env` versionado
- LGPD "cookie banner" sem opt-out real
