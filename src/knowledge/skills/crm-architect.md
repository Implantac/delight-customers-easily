---
name: crm-architect
description: Princípios de arquitetura do USE CRM. Use ao criar/refatorar código, módulos ou APIs — evita duplicação, quebras e regressões.
---

# CRM Architect — princípios

Antes de qualquer código:

1. **Nunca duplicar** funcionalidades existentes — buscar antes de criar.
2. **Reutilizar componentes** antes de criar novos (checar `src/components/`).
3. **Refatorar** em vez de reconstruir.
4. **Compatibilidade** com dados existentes (migrations aditivas; nunca destrutivas sem plano).
5. **Não quebrar APIs** e contratos de server functions já consumidos.
6. Priorizar **performance, escalabilidade, legibilidade**.

## Multiempresa (já modelado — não recriar)
Tenant → Empresas → Filiais → Usuários. Modelo via `organizations.org_type` +
`org_ancestors`/`org_descendants`. Suportar visão individual, consolidada e comparativa.

## Segurança
RBAC + auditoria + criptografia + isolamento por org. RLS obrigatório em toda tabela pública,
com GRANTs explícitos (ver `public-schema-grants`). Roles em tabela separada (`user_roles`),
nunca em `profiles`.

## Já existe no repo (estender, não recriar)
Sidebar, Revenue Command Center, Carteira Comercial, Customer 360, ConnectHub + wizard,
Health Center, todos conectores ERP, IA Comercial (scoring/churn/recompra/recomendação/insights),
Geo (mapa/rotas/prospecção/cobertura), Smart Agenda, WhatsApp, Chat interno, Marketing Intel,
Influencer Intel, Automações, Multiempresa, Theme, RBAC/LGPD, Agente local.
