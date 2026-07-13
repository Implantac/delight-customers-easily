---
name: crm-fundamentals
description: Fundamentos de CRM Enterprise — definições, fronteiras vs ERP/BI/Marketing Automation, Customer Lifecycle, RevOps, Customer Success, Sales Ops, Account Management. Ler antes de qualquer discussão de escopo do produto.
---

# CRM Fundamentals

## O que é CRM
Estratégia customer-centric materializada em software que **acelera receita** e **fortalece relacionamento** ao longo de todo o ciclo de vida do cliente. Três camadas:
- **Operacional** — pipeline, cadastros, atividades, WhatsApp, agenda
- **Analítico** — forecast, ICP, sales velocity, gargalos, cohort
- **Colaborativo** — Mkt → Vendas → CS sem atrito, com contexto compartilhado

## O que NÃO é CRM
Transação financeira, estoque, fiscal, produção, RH, cadastro operacional. Esses são responsabilidade do ERP.

## Fronteiras (para não invadir escopo)
| Sistema | Foco | Exemplo típico |
|---|---|---|
| **CRM** | Relacionamento, receita futura, ação comercial | Pipeline, NBA, churn, Customer 360 |
| **ERP** | Transação, back-office, contabilidade | Estoque, NFe, contas a pagar |
| **PLM** | Ciclo do produto | BOM, engenharia |
| **BI** | Análise histórica genérica | Relatórios ad-hoc |
| **MA** | Nutrição de topo de funil | Fluxo de emails, formulários |

CRM moderno **incorpora MA leve** (campanhas, sequências), **conecta ao ERP** (via ConnectHub) e **incorpora BI comercial** (dashboards executivos) — sem virar ERP.

## Customer Lifecycle (jornada base)
Descoberta → Lead → MQL → SQL → Oportunidade → Cliente → Onboarding → Adoção → Renovação/Expansão → Advocacia.
Cada etapa exige métrica, ação recomendada, e responsável claro.

## RevOps (Revenue Operations)
Alinha Marketing + Vendas + CS sob métricas únicas (pipeline coverage, sales velocity, retention, expansion). Elimina silos de dados e SLA cruzados. É a evolução do "Sales Ops" tradicional.

## Customer Success
Não é suporte reativo — é **gestão proativa de valor entregue**. Ver `mem://customer-success` se existir; senão skill `customer-success` desta KB.

## Account Management
Gestão de contas-chave (Named Accounts) com plano de conta, mapa de stakeholders, upsell/cross-sell estruturados. Difere de "vendas transacionais".

## Sales Operations
Territórios, quotas, comissões, previsibilidade, ferramentas. Foco em **produtividade do vendedor** e previsibilidade de forecast.

## Princípio de escopo
Toda feature nova deve caber em uma das camadas acima. Se não cabe → provavelmente é ERP ou BI genérico.
