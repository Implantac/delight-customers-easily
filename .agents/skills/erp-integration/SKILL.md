---
name: erp-integration
description: Melhores práticas de integração CRM ↔ ERP/OMS/WMS/PDV/e-commerce/marketplace. ConnectHub, outbox pattern, mapping, conflict resolution, health checks, agente local. Ler ao mexer em /integrations, connectors, sync, agente.
---

# ERP Integration (ConnectHub)

## Princípio
CRM **consome** dados comerciais do ERP. Escreve de volta **apenas** o que o usuário configurou explicitamente. Nunca invade escopo de estoque/fiscal/financeiro.

## O que importar (whitelist)
- Clientes (`erp_customers`)
- Representantes (`erp_sales_reps`)
- Histórico de vendas (`erp_sales_history`)
- Métricas RFM (`erp_customer_metrics`) — computadas do histórico
- Catálogo lite (`erp_product_catalog_lite`) — só o necessário para propostas
- Status de crédito/limite comercial (somente leitura)

## O que NUNCA importar
Estoque detalhado, compras, produção, fiscal (NFe/NFSe), contabilidade, RH, folha, cadastros operacionais (CFOP/NCM/CST).

## Conectores suportados
- **REST/GraphQL API** (Bling, Omie, Tiny, Conta Azul, custom)
- **Postgres/MySQL/SQL Server/Firebird/Oracle** direto (leitura)
- **Agente local desktop** (para ERPs on-premise sem exposição pública)
- **Webhook receiver** (ERP empurra eventos)
- **CSV/planilha** (bootstrap inicial)

## Padrões arquiteturais

### Outbox pattern (CRM → ERP)
Mudança no CRM → gravar em `erp_outbox` → worker (`/api/public/hooks/erp-outbox-tick`) processa em fila, com retry exponencial, dead-letter, e log.

### Inbox pattern (ERP → CRM)
ERP envia payload → `/api/public/hooks/erp-inbound` valida assinatura → grava em `erp_inbound_log` → processor idempotente aplica ao CRM.

### Field mapping (`erp_field_mappings`)
Sempre configurável — nunca hardcode "campo X do ERP = campo Y do CRM". Wizard visual.

### Conflict resolution (`erp_sync_conflicts`)
Estratégias:
- **ERP wins** (padrão para dados transacionais)
- **CRM wins** (para dados comerciais como tags, owner)
- **Last write wins** (por timestamp)
- **Manual** (fila para revisão humana)

### Health checks
`erp_health_checks` roda periodicamente: latência, taxa de erro, drift de contagens. `erp-sync-health` UI expõe.

### Sync jobs (`erp_sync_jobs`)
Full sync (semanal) + incremental (contínuo, por watermark). Nunca full em horário de pico.

## Wizard de conexão
UX crítica: usuário leigo conecta em < 5 minutos.
1. Escolher tipo (API / DB / Agente / Webhook)
2. Credenciais (secrets via connectors ou input criptografado)
3. Teste automático (health)
4. Mapping guiado (sugestões IA)
5. Preview (10 linhas) antes de sync
6. Ativar

## Agente Local (para ERPs on-premise)
- Pareamento por token (`erp_agent_tokens`)
- Heartbeat (`/api/public/hooks/erp-local-agent-heartbeat`)
- Push de payloads (`/api/public/hooks/erp-agent-push`)
- Nunca abrir porta pública no ERP do cliente — o agente sai por HTTPS

## Segurança
- Credenciais via secrets (nunca em `.env` público)
- Assinar payloads inbound (HMAC)
- Escopo mínimo do usuário do banco (SELECT nas tabelas whitelisted)
- Log auditável (`erp_diagnostic_messages`)

## Escalabilidade
- Watermark por tabela para incremental
- Chunked reads (não `SELECT *` sem limit)
- Retries com backoff exponencial + jitter
- Rate limit por conexão

## Antipatterns
- Sync em tempo real de tudo (custo + risco)
- Escrever de volta sem confirmação explícita do usuário
- Copiar 100% do schema do ERP para o CRM
- Falhar silenciosamente (sempre gerar alerta + log)
