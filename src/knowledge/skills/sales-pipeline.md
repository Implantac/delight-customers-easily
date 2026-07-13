---
name: sales-pipeline
description: Pipeline, forecast, probabilidade ponderada, stage management, win/loss analysis, sales velocity. Ler ao mexer em /pipeline, /forecast, /oportunidades, /win-loss ou estágios de deal.
---

# Sales Pipeline

## Estágios (default USE CRM)
`lead → qualified → proposal → negotiation → won | lost`
Regras:
- `won`/`lost` disparam `closed_at` (trigger `deals_set_closed_at` já existe)
- Mudar estágio grava evento em `deal_events` para IA e auditoria
- `outcome_reason` obrigatório em `won`/`lost` (para win/loss analysis)

## Probabilidade ponderada (forecast)
Peso default por estágio (já no `compute_sales_forecast`):
```
lead: 0.10, qualified: 0.25, proposal: 0.50, negotiation: 0.75, won: 1.0, lost: 0
```
Forecast ponderado = Σ(value × peso_do_estágio). Snapshot semanal em `sales_forecast_snapshots`.

## Sales Velocity
`(Nº oportunidades × ticket_médio × win_rate) / ciclo_médio_dias`
Métrica-chave para gestor. Card `sales-velocity-card` já existe.

## Win Rate
`won / (won + lost)` por período/segmento/rep/estágio. Alertar quedas > 15% MoM.

## Loss Analysis
Categorizar `outcome_reason` em taxonomia curta (preço, timing, produto, concorrente, sem-fit, sem-resposta).
Nunca deixar texto livre solto — usa enum + campo opcional de detalhe.

## Pipeline Coverage
`pipeline_aberto / meta_do_período`. Regra de bolso: **3x-4x** é saudável. < 2x = alerta vermelho para gestor.

## Stage Management (regras UX)
- Kanban drag-and-drop com **optimistic update** e rollback em erro
- Ao arrastar para `won`/`lost`, abrir modal obrigando `outcome_reason`
- Aging por card (dias no estágio atual) — cor progressiva ao passar do SLA do estágio
- Ao entrar em `proposal`, criar atividade "enviar follow-up em 3 dias" automaticamente (playbook)

## Deal Rot (deals paradas)
Radar visível (`deal-rot-radar` já existe): deals sem atividade há > SLA do estágio. Sugerir ação de reativação.

## Forecast por metodologia
- **Weighted** (padrão, acima)
- **Best case / commit / worst case** (rep escolhe categoria, gestor consolida)
- **AI-driven** (Gong/Clari style) — pode ser overlay futuro

## Antipatterns
- Estágios demais (>7) — vendedor não usa
- Campos obrigatórios por estágio virando burocracia
- Forecast sem histórico de acurácia (mostrar drift do rep)
- Kanban sem filtro por owner/segmento em contas grandes
