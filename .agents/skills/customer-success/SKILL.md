---
name: customer-success
description: Customer Success — health score, churn prediction, adoption, NPS, expansion, retention, onboarding, renewal, success plans. Base do módulo USE Success. Ler ao trabalhar em /use-success, retention, health, churn, NPS, expansion.
---

# Customer Success

Categoria liderada por **Gainsight, Totango, Planhat, ChurnZero, Vitally**. Missão: **valor entregue continuamente** ao cliente pós-venda para retenção e expansão.

## Health Score (composição típica)
- **Product usage** (adoção): logins, features usadas, cobertura de casos de uso
- **Engagement**: respostas, participação em treinamentos, tickets
- **Sentiment**: NPS, CSAT, tom das interações
- **Business outcomes**: KPIs pactuados atingidos
- **Financial**: pagamento em dia, expansão vs contração
- **Support**: volume/severidade de tickets

Classificação: **Verde / Amarelo / Vermelho**. Vermelho = playbook de recuperação obrigatório.

## Churn Prediction
Modelos combinam:
- Queda de uso (7/30 dias)
- Queda de engagement
- Aumento de tickets críticos
- Ausência de champion (rotatividade)
- Sinais competitivos
- Atraso de pagamento

Output: probabilidade + fatores + **ação prescritiva** (contato do CSM, oferta, sessão de valor).

## Adoption (uso do produto)
Métricas:
- **DAU/MAU/WAU**
- **Feature adoption** (quantas features/casos ativos)
- **Time to first value (TTFV)**
- **Time to full value (TTFV completo)**

Playbook: cada feature crítica não adotada em X dias → sequência de ativação.

## NPS / CSAT
- Envio periódico (trimestral típico)
- Segmentar por promoter/passive/detractor
- Detractor → alerta imediato para CSM + playbook de recuperação
- Promoter → programa de referral/case study

## Expansion (upsell/cross-sell)
Sinais:
- Uso próximo do limite do plano
- Novos usuários adicionados
- Novas equipes/departamentos usando
- Feature adjacente usada de forma "hackeada"

Playbook de expansion diferente de renovation.

## Retention / Renewal
- **Renewal forecast** com 90/60/30 dias de antecedência
- Health + histórico compõem probabilidade
- Success plan revisado 60d antes
- QBR (Quarterly Business Review) documentado

## Onboarding
- **Success plan** desde o D0 (metas, marcos, responsáveis)
- **Time-to-first-value** rastreado por cliente
- Templates de onboarding (`onboarding_templates`) por segmento/plano
- Checklist visível ao cliente

## Success Plan (estrutura)
- Objetivos de negócio do cliente
- KPIs pactuados
- Marcos e datas
- Responsáveis (CSM + champion do cliente)
- Riscos identificados
- Próxima QBR

## USE Success (módulo do produto)
Reúne: health score, churn risk, expansion opps, NPS, playbooks, success plans, QBR calendar.
Um CSM abre o USE Success e vê: **meus clientes em risco / oportunidades de expansão / renovações próximas / NPS recentes / tarefas do dia**.

## Antipatterns
- Health score sem playbook associado
- NPS enviado sem loop de fechamento (detractor sem ação)
- Onboarding sem TTFV medido
- Renewal descoberto na última semana
