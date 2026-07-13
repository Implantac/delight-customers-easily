---
name: crm-reporting
description: KPIs comerciais, forecast, análises ABC/XYZ, pipeline, conversion, sales velocity, revenue. Ler ao construir relatórios, /reports, dashboards de gestor, análises segmentadas.
---

# CRM Reporting

## KPIs comerciais essenciais

### Receita
- **Receita realizada** (MTD/QTD/YTD)
- **Recurring revenue** (MRR/ARR) — para SaaS
- **NRR** (Net Revenue Retention) = (start + upsell - downgrade - churn) / start
- **GRR** (Gross Revenue Retention) = (start - downgrade - churn) / start

### Pipeline
- **Pipeline aberto** (valor + count)
- **Pipeline coverage** = pipeline / meta (saudável 3-4x)
- **Pipeline por estágio** (funil)
- **Pipeline por owner/segmento/produto**
- **Pipeline aging** (idade média por estágio)

### Conversão
- **Win rate** = won / (won + lost)
- **Stage conversion** (% que avança de X para Y)
- **Lead → Customer** (topo até fundo)
- **Conversion time** por estágio

### Velocidade
- **Sales velocity** = (nº deals × ticket médio × win rate) / ciclo médio
- **Cycle time** por segmento/produto
- **Time in stage**

### Atividade
- **Atividades por rep** (calls, emails, meetings)
- **Response rate** por canal
- **First response time** (SLA)

### Forecast
- **Weighted forecast** (por peso do estágio)
- **Commit / best case / worst case** (por rep)
- **Forecast accuracy** (histórico: previsto vs realizado)
- **Slippage** (deals que iam fechar e não fecharam)

## Análise ABC (Pareto)
Classificar clientes/produtos por contribuição de receita:
- **A** — top 20% que geram 80% da receita
- **B** — próximos 30% (15% receita)
- **C** — 50% restantes (5% receita)

Atenção diferente por classe. Alerta para churn em A.

## Análise XYZ (previsibilidade)
- **X** — demanda regular (fácil de prever)
- **Y** — demanda com variação (sazonal)
- **Z** — demanda esporádica (imprevisível)

Combinar ABC × XYZ = 9 quadrantes com estratégias específicas.

## Cohort analysis
- Retenção por mês de aquisição
- LTV por cohort
- Comportamento por safra (campanha, canal)

## Segmentações padrão
- Por segmento/CNAE
- Por porte (SMB, mid, enterprise)
- Por região
- Por rep/time
- Por produto/plano
- Por canal de aquisição
- Por health score

## Comparativos (sempre incluir)
- vs período anterior
- vs mesmo período ano passado
- vs meta
- vs média do time
- vs top performer

## Exports e sharing
- CSV/Excel para análise offline
- PDF para reunião executiva
- Link público read-only (com escopo)
- Agendamento (email semanal)

## Anomaly detection
Alertas automáticos:
- Queda > 20% MoM em métrica-chave
- Rep com queda drástica de atividade
- Estágio com bloating anormal
- Churn spike em segmento

## Antipatterns
- Métrica sem contexto (número solto sem comparativo)
- Report que ninguém abre (medir uso, remover mortos)
- KPI vaidoso (aberturas de email sem correlação com receita)
- Forecast sem histórico de acurácia
- Gráfico pizza com 15 fatias
- Dashboard com 20 widgets independentes
