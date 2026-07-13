---
name: commercial-ai
description: IA comercial (AI Copilot, Generative CRM, Recommendation, Predictive, Prescriptive) e benchmark (Salesforce Einstein, HubSpot Breeze, Microsoft Copilot, Zoho Zia, Freshsales Freddy, Pipedrive AI, Monday AI, ClickUp AI, Gong, Clari). Base do USE AI. Ler ao criar/mexer em qualquer feature de IA.
---

# Commercial AI

## Princípio USE CRM
A IA age como **diretor comercial**: nunca só responde, sempre **prescreve ação**. Toda previsão vem com pelo menos uma prescrição prática.

## Camadas de IA no CRM

### 1. Descritiva
"O que aconteceu" — reports, dashboards, health atual. Base para as outras.

### 2. Preditiva
"O que vai acontecer":
- **Lead scoring** (`ai_lead_scores`)
- **Churn prediction** (`ai_churn_predictions`)
- **Repurchase prediction** (`ai_repurchase_predictions`)
- **Deal close probability**
- **Forecast** (Monte Carlo por deal)

### 3. Prescritiva (obrigatória)
"O que fazer agora":
- **NBA** (Next Best Action) — ranking de próximas ações por prioridade
- **Recomendações** (`ai_recommendations`) — clientes para recuperar, cross-sell, campanhas
- **Playbooks contextuais** — sugerir template certo para situação
- **Coaching sugerido** — "esse rep precisa treinar X"

### 4. Generativa
- **Email drafts** (`ai_email_drafts`)
- **Resumo de conversa** (WhatsApp, call)
- **Meeting prep** (contexto do cliente antes da reunião)
- **Propostas iniciais** (rascunho baseado em template + histórico)

### 5. Conversacional (Copilot)
`ai_copilot_threads` — chat com contexto da tela atual:
- "quais deals do João estão em risco?"
- "resuma o cliente X"
- "crie tarefa de follow-up com Maria amanhã"

## Modelos (via Lovable AI Gateway)
- **Padrão**: `google/gemini-2.5-flash` (rápido, barato)
- **Análises pesadas**: `google/gemini-2.5-pro`
- **Embeddings**: `google/text-embedding-004` (semantic search em `customer_embeddings`)
- **Nunca** pedir API key do usuário — `LOVABLE_API_KEY` já injetada

## Benchmark (aprender de cada)

### Salesforce Einstein
- Lead/opportunity scoring nativo
- Einstein GPT (generativo, integrado)
- Prediction Builder (declarativo)
- Explicabilidade forte (top features do score)

### HubSpot Breeze AI
- Content Assistant (email, blog)
- ChatSpot (conversacional)
- Predictive lead scoring
- Data enrichment automático

### Microsoft Copilot (Dynamics)
- Deep integration com Office (Outlook, Teams)
- Meeting insights automático
- Email draft baseado em CRM
- Conversation intelligence (call recording + insight)

### Zoho Zia
- Sentiment em email
- Anomaly detection em pipeline
- Voice assistant

### Freshsales Freddy
- Lead scoring
- Deal insights
- Auto-enrichment

### Pipedrive AI
- Sales assistant (dicas de foco do dia)
- Email templates
- Deal probability

### Monday / ClickUp AI
- Automação de tarefas
- Resumo de projetos
- Sugestão de próxima ação em board

### Gong / Clari (Revenue Intelligence)
- Conversation intelligence (transcrição + análise de calls)
- Deal warning system (health score de deals)
- Forecast probabilístico
- Coaching automático (top performer vs rep)

## Explicabilidade (crítico)
Toda saída de IA tem **breakdown clicável** — nunca caixa preta.
Exemplo: "Este deal está em risco (score 32). Fatores: parado 12d em proposal (-20), sem multithreading (-10), concorrente mencionado (-15), sinal fraco de compra (-10). Ação sugerida: agendar demo com champion e pedir intro para decisor."

## Padrões de UX para IA
- **Chip de confiança** (alta/média/baixa)
- **Explicação em tooltip** (sempre)
- **Ação prática 1-click** anexa
- **Feedback** (útil/não útil) para melhorar modelo
- **Nunca esconder** que é IA (ícone Sparkles + label)
- **Não decidir sozinha** — sugerir, humano aprova

## Guardrails
- Rate limit por org (não sangrar cota LOVABLE_API_KEY)
- Cache de resultados por 24-48h quando aplicável
- Purga de artefatos expirados (`purge_expired_ai_artifacts`)
- Fallback quando IA indisponível (não travar UI)
- LGPD: nunca enviar PII sensível ao modelo sem necessidade

## USE AI (módulo do produto)
Consolida: Copilot conversacional, NBA do dia, recomendações, insights, meeting prep, email drafts, coaching. Um vendedor abre USE AI e vê "aqui estão as 5 melhores coisas para fazer agora".

## Antipatterns
- IA que só reporta o passado ("você teve 10 deals ganhos") — inútil
- Score sem explicação
- Recomendação sem ação de 1 clique
- IA opinando sem citar dados
- Chatbot que não passa pra humano
- Prompt "solto" sem contexto do cliente (resulta em generalidade)
