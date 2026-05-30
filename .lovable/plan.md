
# Refatoração CRM → Plataforma de Inteligência Comercial

Este escopo é gigante (~6 grandes pilares, 70+ rotas atuais). Não dá para fazer
tudo em um único turno sem quebrar o sistema. Proponho **executar em 6 fases
incrementais**, cada uma entregando valor isolado e testável. Você aprova fase
por fase.

## Princípio-guia (vale para todas as fases)

Toda funcionalidade tem que responder SIM a pelo menos uma:
vende mais? acha oportunidade? aumenta produtividade comercial?
melhora relacionamento? ajuda gestor a decidir?

Se não → fica fora do CRM (ou vai pro ERP Connect só como leitura).

---

## FASE 1 — Auditoria + Reorganização da Sidebar  *(esta fase agora)*

**Objetivo:** parar a poluição visual e dar o novo eixo mental do produto.

- Auditar as 70+ rotas atuais e classificar cada uma em:
  *(a) core CRM*, *(b) inteligência comercial*, *(c) integração*,
  *(d) ERP-like a esconder*, *(e) duplicada/morta*.
- Reorganizar a sidebar em **9 grupos comerciais**, com a nova hierarquia:
  ```
  Hoje                → Command Center / Plano do dia
  Carteira Comercial  → Clientes (Customer 360) + Oportunidades
  Pipeline & Metas    → Pipeline, Forecast, Goals
  Relacionamento      → Agenda, Atividades, Tarefas
  Omnichannel         → WhatsApp, E-mail, Chat interno
  IA Comercial        → Copilot, Follow-up IA, Oportunidades IA
  Geointeligência     → Mapa, Rotas, Prospecção geográfica
  BI Comercial        → Reports, Inteligência de Produtos, Win/Loss
  Integrações & ERP   → ERP Connect, Webhooks, Health Center
  Sistema             → Empresas (tenants), Usuários, Configurações
  ```
- Esconder do menu (sem deletar rotas) módulos ERP-like:
  `stock`, `suppliers`, `expenses`, `banking`, `invoices`, `assets`,
  `commissions`, `subscriptions`, `sales-orders`, `quotes`, `contracts`,
  `signatures`, `proposals`, `products` → vão para um grupo
  "ERP (leitura)" colapsado, ou removidos do nav e mantidos só via URL
  até decidirmos caso a caso na Fase 2.
- Renomear rótulos para linguagem comercial (sem jargão técnico).
- Adicionar busca rápida na sidebar (já temos Command Palette ⌘K — só
  reforçar visualmente o atalho).

**Entrega:** uma sidebar enxuta de ~10 itens visíveis por padrão, o resto
agrupado/escondido. Zero rota deletada. Zero funcionalidade quebrada.

---

## FASE 2 — Customer 360 (Carteira Comercial como coração)

- Refatorar `_app.companies.$id.tsx` e `_app.contacts.$id.tsx` em uma
  única tela **Customer 360** com 6 zonas:
  1. Cabeçalho: identificação + score + responsável + ações rápidas
  2. KPIs comerciais: última compra, ticket médio, frequência, MRR
  3. Timeline unificada (atividades + WhatsApp + e-mail + reuniões)
  4. Oportunidades abertas + histórico
  5. Produtos comprados (curva ABC do cliente)
  6. IA panel: "o que fazer com este cliente agora"
- Trazer dados do ERP (quando conectado) só como leitura comercial:
  pedidos, faturamento, inadimplência.
- Manter contacts/companies em rotas separadas só por compatibilidade;
  a navegação primária passa a ser pela Carteira.

---

## FASE 3 — Revenue Command Center (Hoje)

- Nova rota `/command` (já existe — refatorar pesado) virando o
  **dashboard de ações do dia**, não de KPIs estáticos:
  - Clientes em risco
  - Follow-ups atrasados
  - Oportunidades quentes
  - Plano sugerido pela IA para hoje
  - Alertas de inatividade
- Cada card tem CTA direto ("ligar agora", "abrir WhatsApp", "criar tarefa").
- Vira a home logo após o login.

---

## FASE 4 — IA Comercial unificada (Diretor Virtual)

- Consolidar o que hoje está espalhado em `ai-insights`, `copilot`,
  `coaching`, `playbooks`, `intelligence`, `churn`, `leadscore`,
  `forecast` numa **suíte IA Comercial** com 4 agentes claros:
  - Agente de Follow-up
  - Agente de Oportunidades (upsell/cross/reativação)
  - Agente de Risco/Churn
  - Agente de Representantes (ranking + sugestões)
- Cada agente expõe: o que detectou, por quê, ação sugerida, botão de
  aceitar/dispensar/agendar. Tudo via `createServerFn` chamando Lovable
  AI Gateway (`google/gemini-3-flash-preview` por padrão).

---

## FASE 5 — ERP Connect Universal (refatorar wizard)

- Refatorar `_app.integrations.tsx` em wizard de 7 passos linear:
  1. Escolher ERP → 2. Conexão → 3. Testar → 4. IA detecta estrutura →
  5. Validar mapeamento (Smart Mapping) → 6. Sincronizar → 7. Done.
- Criar **ERP Health Center**: status, última sync, erros, latência, filas.
- Smart Mapping com IA: cliente, representante, pedido, financeiro, produto.
- Sem termos de banco de dados na UI.

---

## FASE 6 — Geointeligência + Omnichannel + Automações

- Mapa comercial real (refatorar `opportunity-map`) com prospecção por
  CNAE/segmento e oportunidades de rota.
- Omnichannel: unificar WhatsApp + e-mail + chat numa inbox única
  vinculada ao cliente.
- Motor de automações no-code: SE...ENTÃO... com gatilhos comerciais.
- Alertas diários via WhatsApp (gestor recebe resumo, rep recebe plano do
  dia) — usando server function + cron.

---

## Detalhes técnicos (referência)

- **Stack:** TanStack Start + Supabase (RLS multi-tenant já está sólida).
- **Sem mudanças destrutivas:** nada de `DROP TABLE`. Ocultar ≠ deletar.
- **IA:** sempre via `createServerFn` + Lovable AI Gateway. Nada de chave
  no cliente. Default `google/gemini-3-flash-preview`.
- **RLS:** toda nova feature respeita `is_org_member(org, auth.uid())` —
  invariante do projeto (memory `0029`).
- **UI:** continuar usando os tokens já refinados em `src/styles.css`
  (gradientes, sombras, KPI card, page-container).
- **Performance:** lazy-load por rota já existe via file-based routing;
  vamos adicionar `ensureQueryData` + `useSuspenseQuery` onde ainda
  estiver no padrão antigo, conforme tocar cada tela.

---

## O que eu preciso de você agora

1. **Aprovar este plano em fases** (ou ajustar prioridades).
2. **Confirmar que posso começar pela Fase 1 já neste turno** — ela é
   100% UI/navegação, não toca banco, não quebra nada.
3. Para a Fase 1: confirmar se posso **esconder do menu** os módulos
   ERP-like listados acima (sem deletar), ou se prefere que eu liste
   um por um pra você decidir.

Se aprovar como está, começo pela Fase 1 no próximo turno.
