
# Plano — Backend CRM Enterprise (consome ERP, nunca é ERP)

> **Guardrail absoluto:** nenhum item abaixo cria estoque, compras, financeiro, fiscal, contábil, produção, logística, contas a pagar/receber, fluxo de caixa ou emissão fiscal. Tudo que envolver esses domínios é **somente leitura/consulta** vinda do ERP via conector.

Estado atual já entregue (não será refeito): `organizations` multinível, `memberships`, RLS, `erp_connections/erp_customers/erp_sales_history/erp_customer_metrics`, `customer_360_snapshot`, `ai_lead_scores/churn/repurchase/recommendations`, `geo_locations` + `find_opportunities_in_radius`, VRP em `/geo-rota`, Connect Hub em `/erp-connect`, drivers REST + Postgres + agent-bridged.

---

## Fase 1 — ERP Connect Universal (drivers que faltam)

Objetivo: cobrir os 6 protocolos do manifesto. Hoje temos REST, Postgres e agent-bridged. Faltam **MySQL, SQL Server, Firebird, Oracle**.

- Adicionar drivers em `src/lib/erp-drivers/`:
  - `mysql.ts` (via `mysql2`)
  - `mssql.ts` (via `mssql` / tedious)
  - `firebird.ts` (via `node-firebird` ou agent-bridged se incompatível com Worker)
  - `oracle.ts` (via `oracledb` ou agent-bridged)
- Para drivers Node-only (Firebird/Oracle/MSSQL pesados): rotear **automaticamente** pelo `agent-bridged.ts` (já existente), mantendo a mesma interface `ErpDriver`.
- Registrar todos em `src/lib/erp-drivers/index.ts` com detecção por `connection_type`.
- Validação de credenciais (`testConnection`) obrigatória antes de salvar — já é padrão, só estender.

**Sem novas tabelas.** Reutiliza `erp_connections`.

---

## Fase 2 — ERP Mapping Engine

Hoje o mapeamento é implícito no driver. Vamos explicitar:

- Nova tabela `erp_field_mappings` (org, connection_id, entity `customer|rep|sale`, source_field, target_field, transform jsonb).
- UI em `/erp-connect/$id/mapping` (drag-and-drop simples) — **só configuração**, sem criar entidade do ERP.
- Função `applyMapping(row, mapping)` usada pelo Sync Engine antes do upsert.
- Presets por ERP popular (Bling, Omie, TOTVS, SAP Business One) entregues como JSON seed.

---

## Fase 3 — ERP Sync Engine + Health Center

Objetivo: tornar a sync confiável, observável e bidirecional controlada.

- Tabela `erp_sync_jobs` (queue: pending/running/done/failed, retry_count, last_error, payload).
- Tabela `erp_sync_conflicts` (entity, erp_value, crm_value, resolution `erp_wins|crm_wins|manual`, resolved_at).
- Server fn `enqueueSync({connection_id, direction, entity})` — direção `crm_to_erp` exige flag `bidirectional_enabled` na conexão.
- Worker tick (`/api/public/hooks/erp-sync-tick.ts` já existe) processa fila com lock otimista, escreve auditoria em `audit_log`.
- **Health Center** em `/erp-connect/$id/health`: latência média, taxa de erro 24h, último sync por entidade, conflitos abertos, throughput. Powered by view materializada `erp_connection_health`.

---

## Fase 4 — Inteligência Comercial (responder as 7 perguntas-chave)

Criar server fns que respondem cada pergunta do manifesto, todas filtráveis por org/filial:

| Pergunta | Função | Fonte |
|---|---|---|
| Quem vende mais/menos? | `getRepRanking` | `erp_sales_history` + `users/memberships` |
| Quem devo visitar? | `getVisitPriority` | `customer_360_snapshot` + `ai_churn` + última visita |
| Clientes com potencial? | `getHighPotentialCustomers` | `ai_repurchase_predictions` + RFM |
| Clientes em risco? | `getChurnRisk` | `ai_churn_predictions` |
| Regiões com oportunidade? | `getRegionalOpportunities` | `get_regional_sales_rollup` (já existe) + `find_opportunities_in_radius` |
| Campanhas que funcionam? | `getCampaignROI` | `campaigns` + `deals` won atribuídos |

Dashboard novo `/inteligencia-comercial` agregando os 6 cards.

---

## Fase 5 — Customer 360 ampliado

Expandir `customer_360_snapshot` (refresh já existe) para consolidar **tudo** comercial:

- Adicionar agregados: `whatsapp_msgs_30d`, `emails_30d`, `last_visit_at`, `campaign_touches_90d`, `nps_last`.
- Trigger de refresh incremental quando: nova `activity`, nova `whatsapp_message`, novo `deal`, nova venda importada.
- Página `/companies/$id` já consome — só adicionar os novos blocos.

---

## Fase 6 — IA Comercial em produção (batch + on-demand)

- Agendar `propensity-batch-tick` via `pg_cron` (hourly): indexa embeddings novos e roda scoring para clientes ativos.
- Adicionar `getNextBestAction(customer_id)` que combina churn + repurchase + última atividade → recomendação textual + CTA.
- Painel "IA do Dia" no `/dashboard` com top-10 ações sugeridas para o usuário logado.

---

## O que **NÃO** entra neste plano (por regra absoluta)

- ❌ Cadastro de produtos, estoque, NCM, CFOP
- ❌ Emissão de NFe/NFSe/boleto
- ❌ Contas a pagar/receber, conciliação bancária, fluxo de caixa
- ❌ Folha, ponto, RH
- ❌ Ordens de produção, MRP, logística
- ❌ Qualquer tela "cadastro de X do ERP" — apenas **visualização read-only** de dados sincronizados

Se em qualquer fase surgir necessidade desses dados, a resposta é **sempre**: "ler do ERP via conector existente", nunca criar no CRM.

---

## Ordem sugerida de execução

1. **Fase 4** (Inteligência Comercial) — maior valor percebido, usa dados já existentes
2. **Fase 6** (IA em produção via pg_cron) — destrava os scores que já temos
3. **Fase 5** (Customer 360 ampliado) — completa a visão
4. **Fase 3** (Sync Engine + Health) — confiabilidade
5. **Fase 2** (Mapping Engine) — flexibilidade de integração
6. **Fase 1** (drivers MySQL/MSSQL/Firebird/Oracle) — cobertura de protocolos

Cada fase é independente e entregável isoladamente. Posso começar pela Fase 4 assim que aprovado.
