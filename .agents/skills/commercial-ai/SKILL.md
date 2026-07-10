---
name: commercial-ai
description: Padrão da IA Comercial, Geointeligência, Representantes e Marketing Inteligente no USE CRM. Use ao trabalhar em recomendações, scoring, churn, NBA, rotas, campanhas ou tracking de leads.
---

# Commercial AI — padrão

A IA age como **diretor comercial**: não responde só perguntas, gera recomendações automáticas com **ação prática** anexa.

## Recomendações que a IA deve gerar
- Clientes para recuperar / em risco (churn)
- Oportunidades de recompra, cross-sell, upsell
- Regiões prioritárias
- Campanhas recomendadas
- Agenda diária (Meu Dia)
- Rotas otimizadas

Cada recomendação → 1 ação concreta (canal, mensagem-chave, prazo). Usar Lovable AI Gateway
(`google/gemini-2.5-flash` padrão; `gemini-2.5-pro` para análises pesadas). Nunca pedir API key
ao usuário — usar `LOVABLE_API_KEY` (já injetada).

## Geointeligência
- Mapear clientes por lat/lng.
- Identificar prospects e sugerir oportunidades próximas à rota do representante.
- Indicar regiões com baixa cobertura.
- Estimar potencial comercial por cidade/segmento/CNAE.

## Representantes
Indicadores (foco em **apoiar**, não fiscalizar): visitas realizadas, taxa de conversão,
ticket médio, follow-ups, cobertura de carteira, potencial explorado.

## Marketing Inteligente
Canais que convergem para o CRM: WhatsApp, Instagram, Facebook, TikTok, LinkedIn, site, landing pages.
Cada contato → lead com origem rastreada (UTM/canal) e histórico completo.
IA sugere campanhas por comportamento, região, sazonalidade, desempenho de produto.

Integrações que exigem ação do usuário (não fazer sozinho): Instagram/FB/TikTok/LinkedIn (app +
secrets via `add_secret`); email inbound em domínio próprio; Google Business (OAuth GCP).
