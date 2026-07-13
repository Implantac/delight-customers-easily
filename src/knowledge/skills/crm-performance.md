---
name: crm-performance
description: Performance para CRM com grande volume — virtualization, infinite scroll, lazy loading, realtime, caching, offline-first, índices. Ler ao mexer em listas grandes, tabelas, realtime, ou reclamação de lentidão.
---

# CRM Performance

## Contexto
CRMs mid-market/enterprise passam de **milhões de contatos, atividades, mensagens**. Feature que funciona com 100 registros pode travar com 100k.

## Frontend

### Virtualization (obrigatório > 200 linhas)
`@tanstack/react-virtual` para tabelas/listas grandes. Renderiza só o viewport.

### Infinite scroll vs paginação
- **Infinite scroll**: feed contínuo (timeline, inbox WhatsApp)
- **Paginação**: relatórios, tabelas com filtros/export
- Sempre com `cursor-based` (não `offset` — degrada em grandes tabelas)

### Lazy loading
- Rotas via TanStack Router (automático)
- Componentes pesados (`React.lazy` + Suspense) — ex.: mapas, editores rich text
- Imagens: `loading="lazy"` + `srcset`

### Query caching (TanStack Query)
- `staleTime` alto para dados quase-estáticos (segments, custom fields): 5-30min
- `gcTime` generoso (10-30min) para navegação rápida
- `queryKey` estruturado: `['deals', orgId, filters]`
- Invalidação cirúrgica (`invalidateQueries({ queryKey: ['deals', orgId] })`)

### Optimistic updates
Para toda mutação simples (mover deal, marcar task). Rollback em erro.

### Realtime
- Só onde muda comportamento (inbox, notificações, colaboração ao vivo)
- **Nunca** para listas grandes (usar polling ou refetch on window focus)
- Filtrar por `organization_id` do lado do servidor

### Bundle size
- Tree-shakeable icons (`lucide-react` já ok)
- Evitar libs pesadas para tarefas simples (`date-fns` > `moment`)
- Analisar bundle periodicamente

## Backend / DB

### Índices
Regra: toda coluna usada em `WHERE` ou `ORDER BY` frequente em query multi-tenant deve ter índice composto `(organization_id, <coluna>)`. Já padrão nas tabelas do projeto.

### Consultas
- Nunca `SELECT *` em tabela grande
- `LIMIT` sempre presente
- Preferir `count: 'estimated'` a `count: 'exact'` em contagens de listas
- CTEs para queries complexas em vez de N+1

### Materialized views / snapshots
Agregados pesados (Customer 360, RFM, forecast) — computar em batch, ler rápido.
`customer_360_snapshot` + `refresh_customer_360` já implementados.

### Batching
Pg_cron + `/api/public/hooks/*` para:
- Refresh de snapshots
- Recompute de scores
- Envio de campanhas
- Sync ERP incremental
- Purga de artefatos expirados

### RLS
Sempre com índice compatível. `is_org_member` é STABLE + SECURITY DEFINER — não penaliza.

## Offline-first (mobile field sales)
- Baixar "meu dia" (rotas, visitas, contatos daquele dia) no login
- Fila local de mudanças (IndexedDB) → sync ao voltar rede
- Conflict resolution simples (last-write-wins com timestamp)
- Service Worker para assets

## Monitoring
- Log de queries > 500ms (`supabase--slow_queries`)
- Sentry para erros frontend
- Alerta em endpoints > 2s p95

## Antipatterns
- `useEffect` + `fetch` em loop
- Refetch a cada render
- Realtime em tela com 10k linhas
- `for` chamando query dentro (N+1)
- Sem índice em coluna filtrada
- Cache global sem invalidação
- Renderizar 5k linhas sem virtualization
