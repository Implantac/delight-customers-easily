---
name: sales-intelligence
description: Revenue Intelligence / Sales Intelligence — buying signals, opportunity intelligence, predictive & prescriptive sales, deal health, forecast probabilístico. Ler ao trabalhar com IA de deals, NBA, insights, forecast avançado.
---

# Sales Intelligence

Categoria liderada por **Gong, Clari, People.ai, Aviso**. Objetivo: transformar dados de execução comercial em **decisão e ação**.

## Sinais de compra (buying signals)
- Múltiplos stakeholders envolvidos (>= 3 contatos ativos)
- Aumento de frequência de interação
- Solicitação de proposta / preço / referência
- Abertura repetida de email/proposta
- Visitas ao site em páginas de preço
- Menção de concorrente
- Uso de palavras-chave: "orçamento", "aprovação", "quando", "próximos passos"

Cada sinal detectado vira **insight** no `deal-insight-panel` + boost no score.

## Deal Health Score
Composição:
- **Stage vs age** — parado além do SLA = red flag
- **Multithreading** — quantos contatos envolvidos
- **Cadência** — atividades últimos 14d
- **Sentimento** — tom das respostas (email/WhatsApp)
- **Fit ICP** — aderência do cliente
- **Sinais de compra** — presentes ou ausentes
- **Concorrente identificado** — presença

Score 0-100 + classificação: **Saudável / Atenção / Em risco / Crítico**.
Cada deal em risco tem NBA para reativação.

## Opportunity Intelligence
Para cada deal aberto:
- Probabilidade de ganho (IA vs peso do estágio)
- Data provável de fechamento (regressão)
- Valor final provável (upsell/discount adjusted)
- Concorrente mais provável
- Próximo passo recomendado

## Predictive vs Prescriptive
- **Predictive** ("vai acontecer X"): churn, recompra, close date, forecast
- **Prescriptive** ("faça X agora"): NBA, follow-up, script sugerido, próxima visita

**Regra USE CRM**: toda previsão gera pelo menos uma prescrição. Nunca previsão isolada.

## Forecast probabilístico
Além do weighted:
- Distribuição de cenários (P50/P90) por deal
- Consolidação Monte Carlo em nível de time/org
- Comparar forecast atual com histórico do rep (calibration/drift)

## Coaching automático
Comparar rep vs top performer da org em:
- Discovery calls (perguntas por reunião)
- Tempo por estágio
- Multithreading médio
- Win rate por segmento

Sugerir play/artigo/exemplo específico.

## Explicabilidade (crítico)
Cada insight/score tem **breakdown** clicável — nunca caixa preta.
IA deve dizer POR QUE ("Deal parou 12 dias no proposal, sem multithreading, sinal fraco de compra").

## Antipatterns
- Score sem explicação
- Alerta sem ação sugerida
- Previsão sem histórico de acurácia
- IA "opinando" sem citar dados
