---
name: crm-architecture
description: Padrões arquiteturais de CRMs enterprise (Salesforce, HubSpot, Dynamics, Pipedrive, Attio) — multi-tenant, event-driven, DDD, clean architecture, API-first, modularidade, escalabilidade. Ler ao propor mudanças estruturais grandes.
---

# CRM Architecture

## Multi-Tenant (crítico)
- **Shared schema + tenant_id** (nosso padrão via `organization_id` + RLS) é o mais comum e escalável para SaaS mid-market. Salesforce/HubSpot usam variantes disso.
- **Schema-per-tenant** só para enterprise com isolamento regulatório extremo.
- **DB-per-tenant** para high-touch/on-prem.
- Hierarquia: **Tenant → Empresa → Filial → Usuário** (já modelado via `organizations.org_type` + `org_ancestors`/`org_descendants`). Nunca colocar "matriz/filial" em coluna solta — sempre árvore.

## Event-Driven
CRMs modernos publicam eventos em cada mudança de estado (`deal.stage_changed`, `contact.created`, `whatsapp.message_received`) para:
- Trigger de automações (`commercial_automations`)
- Sincronização ERP (`erp_outbox`)
- Notificações, IA proativa, webhooks
- Auditoria (`audit_log`)

Padrão: **outbox pattern** (nossa `erp_outbox` já implementa). Nunca disparar side-effects direto no controller.

## Domain-Driven Design (DDD)
Bounded contexts sugeridos:
- **Sales** (deals, pipeline, forecast)
- **CRM Core** (companies, contacts, activities)
- **Customer Success** (health, retention, NPS)
- **Marketing** (campaigns, leads, sequences)
- **Revenue Intelligence** (AI, insights, NBA)
- **Integration** (ConnectHub, ERP outbox/inbox)
- **Identity** (orgs, memberships, roles)

Cada contexto tem seu próprio modelo — não misturar "cliente ERP" com "contato de marketing" no mesmo objeto.

## Clean Architecture (aplicado ao stack)
- **Camada de apresentação:** rotas TanStack + componentes React
- **Camada de aplicação:** server functions (`*.functions.ts`)
- **Camada de domínio:** validação Zod + regras de negócio puras
- **Camada de infra:** Supabase client, integrações externas (`*.server.ts`)

Nunca chamar `supabaseAdmin` de um componente. Nunca colocar regra de negócio em route file.

## API-First
Cada capacidade comercial deve ter **server function tipada** antes da UI. Isso permite:
- Reuso mobile / integrações externas
- Testabilidade
- Contratos estáveis (versionar antes de quebrar)

## Modularidade
Features em pastas por domínio, não por tipo de arquivo. Ex.: `src/routes/_app.pipeline.tsx` + `src/lib/pipeline.functions.ts` + `src/components/pipeline-*.tsx`.

## Escalabilidade prática (Cloud Supabase)
- Índices compostos por `(organization_id, <coluna quente>)` — já padrão nas nossas tabelas.
- Materialized views para agregados pesados (ex.: `customer_360_snapshot`).
- `pg_cron` + rotas `/api/public/hooks/*` para batch (recomendação, purga, forecast).
- Realtime só para inbox/notificações; nunca para listas grandes.
- Evitar `SELECT *` cross-org; sempre filtrar por `organization_id` (RLS + índice).

## Benchmark rápido
- **Salesforce**: metadata-driven, multi-tenant compartilhado, event bus (Platform Events)
- **HubSpot**: monolito modular + microserviços por produto (Hub), APIs REST v3
- **Dynamics 365**: Dataverse (metadata + segurança) + Power Platform
- **Attio / Folk**: modelo de "records" flexível (schemaless-ish), realtime, colaborativo
- **Pipedrive**: focado em pipeline, sem multi-produto pesado

Aprender de todos, copiar de nenhum — nossa personalidade é copiloto comercial.
