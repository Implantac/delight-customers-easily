---
name: customer-360
description: Padrões de Single Customer View — timeline unificada, score, histórico, omnichannel, contexto acionável. Ler ao mexer em /customer-360, /companies/$id, snapshot ou qualquer tela que consolide informação de cliente.
---

# Customer 360

## Objetivo
Vendedor entende a situação de um cliente em **menos de 1 minuto** e sabe qual é a próxima ação.

## Componentes obrigatórios (na ordem)
1. **Cabeçalho identidade** — razão social, CNPJ, cidade/UF, segmento, dono da conta, tags
2. **Health & Score** — RFM, health score, churn risk, potencial de recompra (chips coloridos)
3. **Próxima ação recomendada (NBA)** — 1 CTA proeminente com motivo e canal
4. **Timeline unificada** — todas interações em ordem cronológica reversa: deals, atividades, WhatsApp, email, notas, mudanças de estágio, campanhas recebidas
5. **Contatos-chave** — decisor, comprador, técnico (com foto/iniciais)
6. **Histórico comercial** — receita últimos 12m, ticket médio, freq, última compra, top produtos
7. **Pipeline aberto** — deals em andamento com estágio e valor
8. **Marketing & campanhas** — engajamento recente, origem/UTM
9. **Documentos & propostas** — proposals, contracts, arquivos
10. **Ações rápidas** — WhatsApp, email, ligar, agendar, criar deal, adicionar nota

## Snapshot vs on-demand
Dados quentes (deals abertos, atividades) via query realtime; agregados pesados (RFM, health, 365d)
via `customer_360_snapshot` materializado (`refresh_customer_360`). Refresh em batch (cron) + manual.

## Timeline
Fonte única com colunas normalizadas: `type`, `at`, `title`, `preview`, `actor`, `direction`, `channel`, `deep_link`. Merge de: activities, whatsapp_messages, email_campaign_recipients, deal_events, notes, audit_log filtrado.

## Omnichannel
Sempre indicar canal (WhatsApp, Email, Ligação, Reunião, Visita, Chat, LinkedIn) e direção (in/out).
Contadores por canal últimas 30/90 dias.

## Score composto (exemplo)
- Recency (30%) — dias desde última interação
- Frequency (25%) — interações últimos 90d
- Monetary (25%) — receita 365d
- Engagement (10%) — respostas/aberturas
- Fit (10%) — aderência a ICP

Nunca mostrar score sem **explicação** (tooltip com breakdown).

## Contexto acionável
Cada bloco tem CTA. Nunca listar dados "para consulta"; sempre "aqui está o que você pode fazer com isso".

## Antipatterns
- Abas escondendo dados críticos (usar seções empilhadas com âncoras)
- Score isolado sem explicação
- Timeline paginada sem filtro por canal/tipo
- Duplicar informação já visível no cabeçalho
