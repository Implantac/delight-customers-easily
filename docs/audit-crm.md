# Auditoria — USE CRM (Onda 1)

Regra única usada para classificar cada rota:

> "Isso ajuda diretamente a gerar lead, converter, vender mais, reter,
> gerenciar representante, melhorar marketing ou identificar
> oportunidade?"

Status possíveis:
- **MANTER (primária)** — entra nos 17 itens top-level da sidebar.
- **APROFUNDAR** — capacidade comercial relevante, mas secundária; vai
  para um grupo recolhido ("Comercial — aprofundar", "Engajamento —
  aprofundar", "Atendimento").
- **ERP (consulta)** — cheira a ERP. Não é removida (links existentes
  continuam valendo) mas sai da navegação primária e fica no grupo
  "Integrações ERP (consulta)", recolhido por padrão.
- **SISTEMA** — utilitário interno; recolhido.

Nenhuma rota foi deletada nesta onda. Tudo continua acessível por URL
direta, command palette e busca.

---

## Navegação primária (17 entradas)

| # | Item              | Rota                       | Justificativa |
|---|-------------------|----------------------------|---------------|
| 1 | Dashboard         | `/dashboard`               | Visão geral comercial; vira Revenue Command Center na Onda 2. |
| 2 | Carteira          | `/carteira`                | Carteira comercial filtrável — coração do CRM. |
| 3 | Leads             | `/marketing`               | Inbox de leads omnichannel. |
| 4 | Clientes          | `/contacts`                | Base de clientes; Customer 360 entra na Onda 3. |
| 5 | Oportunidades     | `/opportunity-map`         | Vira "Central de Oportunidades" na Onda 4. |
| 6 | Representantes    | `/goals`                   | Provisório (metas/ranking); módulo dedicado na Onda 5. |
| 7 | Agenda            | `/calendar`                | Visitas, reuniões, follow-ups. |
| 8 | WhatsApp          | `/whatsapp`                | Multi-atendimento. |
| 9 | Marketing         | `/campaigns`               | Campanhas / e-mail / cadência. |
| 10| Influencers       | `/influencers`             | Canal de vendas via influenciador. |
| 11| Geointeligência   | `/geo`                     | Mapa comercial + rotas. |
| 12| IA Comercial      | `/ia-comercial`            | Agentes / copiloto. |
| 13| Relatórios        | `/reports`                 | BI comercial. |
| 14| Integrações ERP   | `/integrations`            | ERP Connect Hub. |
| 15| Empresas          | `/companies`               | Tenants / filiais / grupo. |
| 16| Configurações     | `/settings/organization`   | Usuários + workspace (uma única tela hoje). |

> Observação: "Usuários" e "Configurações" do briefing apontam para a
> mesma tela `/settings/organization` (a aba "Membros" cumpre o papel de
> "Usuários"). Vamos separar quando o módulo de RBAC ganhar tela própria.

---

## Aprofundar — Comercial

Capacidades que apoiam vendas mas eram clutter na nav primária.

| Rota              | Status     | Por quê |
|-------------------|------------|---------|
| `/pipeline`       | Aprofundar | Visão Kanban do funil; promovida quando virar parte da Central de Oportunidades. |
| `/forecast`       | Aprofundar | Previsão de receita. |
| `/win-loss`       | Aprofundar | Diagnóstico de fechamento. |
| `/lead-scoring`   | Aprofundar | Configuração de score; uso pontual. |
| `/retention`      | Aprofundar | Risco de churn — vira card no Revenue Command Center. |
| `/segments`       | Aprofundar | RFM. |
| `/territories`    | Aprofundar | Cobertura territorial. |
| `/cohorts`        | Aprofundar | Análise de coortes. |
| `/benchmark`      | Aprofundar | Comparativo entre empresas — promove na Onda 6. |
| `/productivity`   | Aprofundar | Produtividade comercial. |
| `/commissions`    | Aprofundar | Comissão é insumo do módulo Representantes (Onda 5). |

## Aprofundar — Engajamento

| Rota              | Status     | Por quê |
|-------------------|------------|---------|
| `/activities`     | Aprofundar | Tarefas comerciais (lista). |
| `/mytasks`        | Aprofundar | Minhas tarefas. |
| `/chat`           | Aprofundar | Chat interno corporativo. |
| `/templates`      | Aprofundar | Templates de mensagens/e-mail. |
| `/sequences`      | Aprofundar | Cadências. |
| `/lead-forms`     | Aprofundar | Formulários / LPs de captação. |
| `/referrals`      | Aprofundar | Indicações. |
| `/surveys`        | Aprofundar | NPS / pesquisa. |
| `/loyalty`        | Aprofundar | Fidelidade. |
| `/coaching`       | Aprofundar | Coaching IA. |
| `/playbooks`      | Aprofundar | Playbooks de venda. |
| `/command`        | Aprofundar | Plano do dia — vira parte do Revenue Command Center na Onda 2. |
| `/alerts`         | Aprofundar | Alertas inteligentes. |

## Atendimento (recolhido)

| Rota              | Status     | Por quê |
|-------------------|------------|---------|
| `/tickets`        | Atendimento | Suporte / SAC. |
| `/kb`             | Atendimento | Base de conhecimento. |
| `/routing`        | Atendimento | Roteamento de tickets. |
| `/approvals`      | Atendimento | Aprovações internas. |

---

## ERP (consulta) — saiu da nav primária

Cada item abaixo descreve **dado comercial** vindo do ERP. Quando o ERP
Connect amadurecer (Onda futura), estas telas viram apenas leitura
estratégica (já é o caso na maior parte delas).

| Rota               | Por quê é ERP |
|--------------------|----------------|
| `/products`        | Catálogo de produtos — mestre vive no ERP. |
| `/proposals`       | Propostas comerciais — formalização contratual. |
| `/quotes`          | Orçamentos — geralmente parte do ERP de vendas. |
| `/sales-orders`    | Pedido de venda — ERP. |
| `/contracts`       | Contratos — jurídico/ERP. |
| `/signatures`      | Assinatura eletrônica — workflow externo. |
| `/invoices`        | Faturas / cobrança — financeiro. |
| `/finance`         | Financeiro — fora de escopo. |
| `/subscriptions`   | Recorrência — billing. |
| `/banking`         | Bancos — financeiro. |
| `/expenses`        | Despesas — financeiro. |
| `/stock`           | Estoque — ERP. |
| `/suppliers`       | Fornecedores — compras/ERP. |
| `/assets`          | Ativos — patrimônio. |
| `/time`            | Apontamento de horas — RH. |
| `/documents`       | Documentos contratuais — gestão documental. |
| `/settings/erp-agent` | Configuração do agente local. |

> Decisão consciente: **não deletar** nesta onda. Remoção exige confirmar
> com cada cliente que nenhum desses módulos é usado como CRM-light. A
> proposta é deixá-los visíveis apenas como "Integrações ERP (consulta)"
> e revisitar para remoção definitiva quando o ERP Connect tiver
> substituído cada um.

---

## Sistema (recolhido)

| Rota                | Por quê é Sistema |
|---------------------|--------------------|
| `/notifications`    | Caixa de notificações do usuário. |
| `/onboarding`       | Tour inicial. |
| `/data-quality`     | Higienização de base. |
| `/audit`            | Log de auditoria. |

---

## Itens redundantes detectados (a fundir nas próximas ondas)

- **Tarefas em três lugares**: `/activities`, `/mytasks` e o widget de
  tarefas dentro de `/calendar`. Plano: manter `/mytasks` como caixa de
  entrada pessoal e `/activities` como visão gerencial; remover o widget
  duplicado de tarefas do `/calendar`.
- **Plano do dia × Dashboard × Alertas**: `/command`, `/dashboard` e
  `/alerts` competem pela atenção da home. Onda 2 consolida em um único
  "Revenue Command Center" e empurra `/command` para atalho.
- **Marketing × Campanhas × Inbox de leads**: `/marketing`, `/campaigns`
  e `/lead-forms` falam de funções diferentes mas vivem perto. Onda 6
  reorganiza num único módulo "Marketing".
- **Goals × Productivity × Commissions × (futuro) Representantes**:
  hoje espalhados. Onda 5 funde tudo no módulo Representantes.
- **Companies × Settings/Organization**: confusão entre "tenants" e
  "minha organização". Onda 6 traz multi-empresa real.

---

## Próxima onda

Pronto para iniciar a **Onda 2 — Revenue Command Center** quando o
usuário aprovar.
