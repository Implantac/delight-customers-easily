---
name: marketing-intelligence
description: Campanhas, ROI, CAC, LTV, segmentação, automação, journey, remarketing, attribution multi-touch. Ler ao mexer em /marketing-intel, /campaigns, /influencers, /lead-forms, sequências.
---

# Marketing Intelligence

## Objetivo no CRM
Marketing não é módulo isolado — é **motor de leads qualificados** com **atribuição rastreável até receita**.

## KPIs essenciais
- **CAC** (Customer Acquisition Cost) = investimento total / novos clientes
- **LTV** (Lifetime Value) = receita média × margem × duração média
- **LTV:CAC** — saudável > 3:1
- **Payback period** — meses para recuperar CAC
- **MQL → SQL → Won** conversion rates por canal
- **ROI por campanha** (receita atribuída − custo) / custo
- **CPL** (Custo por Lead) por canal

## Segmentação
Dimensões: RFM, health, ICP fit, engajamento, região, segmento, produto comprado, estágio do funil, comportamento no site.
Salvar como `saved_views` reutilizáveis.

## Journey / Customer Journey Mapping
Etapas: **Awareness → Consideration → Decision → Retention → Advocacy**.
Cada etapa tem KPI, conteúdo, canal, oferta. Mapear atrito e drop-off.

## Automação (`commercial_automations` + `sequences`)
Triggers comuns:
- Formulário preenchido → sequência de nurturing
- Deal parou em proposal 7d → follow-up + tarefa rep
- Cliente atingiu health vermelho → playbook CSM
- Aniversário/renovação próximo → email personalizado
- Abandono de proposta → remarketing

Sempre com **opt-out** e respeito à janela horária.

## Attribution
- **First-touch**: primeiro contato ganha crédito (útil para topo)
- **Last-touch**: último contato ganha (útil para fundo)
- **Multi-touch linear**: divide igual entre touches
- **Time-decay**: touches recentes pesam mais
- **U-shape / W-shape**: pondera key moments

USE CRM: registrar todos os touches (`source_kind`, `source_id`, UTM) e permitir escolher modelo no dashboard.

## Remarketing
Segmentos comuns:
- Visitou preço mas não converteu
- Baixou proposta e sumiu
- Cliente inativo > 90d
- Cross-sell (comprou X, tem fit para Y)

## Influencer Intelligence (`/influencers`)
Cada influencer tem: cupom único, LP personalizada, tracking de visitas/conversões, comissão configurável, ROI.
`influencer_conversions` + `influencer_visits` já implementados.

## Email Campaigns
- **List hygiene**: bounce, spam complaint, opt-out
- **A/B test**: subject, CTA, horário
- **Warm-up** de domínio novo
- **Segmentação**: nunca disparar para "toda a base"
- **Report**: open, click, reply, conversão a deal

## Lead Forms (`/lead-forms`)
- Campos mínimos (nome, email, empresa) — resto enriquece
- Progressive profiling (pedir mais em interações futuras)
- reCAPTCHA / honeypot antibot
- Roteamento automático ao rep
- Confirmação clara + próximos passos

## Landing Pages (por influencer, campanha, produto)
- Copy focada em 1 CTA
- Prova social (logos, cases, NPS)
- Formulário curto acima da dobra
- Meta tags e SEO próprios (nunca reusar da home)

## Antipatterns
- Campanha sem attribution
- Nurturing genérico sem segmento
- Automação sem opt-out
- Métrica vaidosa (open rate) sem métrica de negócio (deal criado)
- Enviar para lista comprada
