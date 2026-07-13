---
name: lead-management
description: Lead scoring, routing, distribuição, enriquecimento, qualificação MQL/SQL/SAL, ICP, persona. Ler ao mexer em /leads, /lead-forms, roteamento, enriquecimento CNPJ, ou funil topo.
---

# Lead Management

## Funil canônico
`Anônimo → Lead → MQL (marketing qualified) → SAL (sales accepted) → SQL (sales qualified) → Oportunidade`

Cada transição precisa de critério objetivo — nunca "achismo".

## ICP (Ideal Customer Profile)
Definido por: segmento/CNAE, porte (funcionários/faturamento), região, stack, comportamento.
ICP fit compõe score. Exibir na página do lead.

## Persona
Papel do contato: decisor, influenciador, comprador, técnico, usuário final.
Mapear na conta (Account Map) para vendas complexas.

## Lead Scoring (composto)
- **Fit** (ICP): segmento, porte, região, cargo
- **Behavior**: aberturas email, visitas site, formulários, WhatsApp respondido
- **Intent**: solicitou demo, baixou proposta, pediu preço
- **Recency**: decai com o tempo se não interage

Score visível (0-100) + tier (A/B/C/D) + tooltip com breakdown.

## Lead Routing
Regras (`lead_routing_rules`) por: território, segmento, tamanho, produto, round-robin, load-balancing.
Log obrigatório em `lead_routing_log` para auditoria e drift analysis. SLA de resposta configurável.

## Lead Distribution
- **Round-robin** simples para leads iguais
- **Weighted** quando reps têm quotas diferentes
- **Skill-based** para produtos complexos
- **Territory** para geo/segmento

## Lead Enrichment
Auto-preencher:
- CNPJ → razão social, CNAE, endereço, sócios (usar `cnpj-search` já existe)
- Email/domínio → empresa, tamanho
- IP/geo do formulário → cidade
- LinkedIn (quando conector disponível) → cargo, senioridade

Nunca pedir ao usuário o que dá pra buscar.

## Qualificação (frameworks)
- **BANT** (Budget, Authority, Need, Timeline) — clássico, para vendas transacionais
- **MEDDIC/MEDDPICC** — enterprise (Metrics, Economic buyer, Decision criteria/process, Identify pain, Champion, Competition)
- **SPIN/CHAMP** — consultivo

Nunca engessar — permitir template configurável por org.

## Attribution (origem)
Toda entrada de lead grava `source_kind` + `source_id` + UTM. Rastrear até fechamento (won) para calcular ROI por canal/campanha/influencer.

## SLA de resposta
- **Lead quente** (score A): < 5 min
- **MQL**: < 1 hora
- **Cold**: < 24h

Alerta se estourar. NBA "responda agora" é obrigatório para leads A.

## Antipatterns
- Formulário pedindo 15 campos (perde 90% dos leads)
- Score sem decaimento (leads antigos poluem a lista)
- Roteamento sem log (impossível auditar)
- MQL definido só por score, sem comportamento
