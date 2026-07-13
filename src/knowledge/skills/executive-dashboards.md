---
name: executive-dashboards
description: Dashboards executivos para C-level e gestores comerciais. Padrões de HubSpot, Salesforce, Monday, Dynamics, Power BI, Tableau. Base do módulo USE Success. Ler ao mexer em /dashboard-executivo, /dashboard, /reports/dashboards, /gestao-*.
---

# Executive Dashboards

## Princípio
Executivo não navega — **vê a verdade em 10 segundos** e clica só se algo estiver fora do esperado.

## Regra 5-3-1
- **5 KPIs** máximos no topo
- **3 tendências** (linha/barra) no meio
- **1 tabela** de exceções embaixo (o que exige ação)

## KPIs comerciais canônicos
1. **Receita realizada** (MTD, QTD, YTD) vs meta
2. **Pipeline aberto** (valor total + coverage ratio)
3. **Forecast ponderado** para fim do período + confiança
4. **Win rate** (rolling 90d) por segmento/rep
5. **Sales velocity**
6. **CAC / LTV / LTV:CAC**
7. **Churn / NRR / GRR** (para SaaS/recorrência)
8. **Health score médio** da base
9. **NPS**

## Layouts por persona

### CEO / Diretor
Receita vs meta, growth YoY, health da base, top oportunidades em risco, top expansions.

### CRO / Diretor Comercial
Pipeline coverage, forecast confidence, win rate por rep/segmento, sales velocity, deals em risco.

### Sales Manager
Pipeline do time, atividades por rep, leaderboard, deals paradas, quotas.

### CSM Manager
Renewals próximas, health vermelho, expansion opps, NPS detractors, tickets críticos.

### Rep (Meu Dia)
Tarefas do dia, meta pessoal, deals a mover, mensagens não respondidas, NBA top 3.

## Padrões de UX
- **Filtros globais** persistidos por usuário (período, org, segmento, owner)
- **Comparativo automático** (vs período anterior, vs meta, vs ano passado)
- **Drilldown** em cada card (clique = detalhe)
- **Anotações** (marcos: lançamento, campanha, contratação)
- **Alertas** (mudança > X% dispara notificação)
- **Export** (PDF/PNG para reunião)
- **Compartilhamento** com escopo (org/time/link público read-only opcional)

## Cores e semântica
- Verde = acima da meta / saudável
- Amarelo = atenção / abaixo mas dentro do range
- Vermelho = crítico / requer ação
- Sempre usar tokens semânticos (`bg-emerald-500/10`, `text-destructive`) — nunca hex.

## Performance
- Agregados pré-computados (materialized views, snapshots) — nunca calcular do zero em cada request
- Caching por período (TTL 5min-1h dependendo do KPI)
- Skeleton loading + streaming quando possível

## USE Success (dashboard do produto)
Consolida: pipeline coverage, forecast, top opportunities, deals em risco, health score da base,
churn risk, expansion pipeline, NPS, atividades do time, meta atingida. **Uma tela = uma decisão possível a cada bloco.**

## Antipatterns
- Dashboard com 30 widgets ("configurou tudo, olha nada")
- Métricas sem contexto (número sem comparativo/meta)
- Gráficos 3D, pizza com >5 fatias, cores arbitrárias
- Filtro que não persiste
- Drilldown que abre em modal em vez de rota (perde histórico)
