# Plano — Refatoração Frontend: CRM Enterprise Premium

**Princípio absoluto:** zero aparência de ERP. Toda tela responde *"O que devo fazer hoje para vender mais?"*. Sem alterar regras de negócio — só camada visual, navegação, composição e microinterações.

---

## Fase 1 — Design System (fundação)

Refatorar `src/styles.css` com tokens inspirados em Attio + Linear:

- **Paleta clara:** branco quente (`oklch(0.99 0.005 95)`), surface elevada, primary indigo profundo (`oklch(0.45 0.18 265)`), accent vibrante para ações IA.
- **Paleta escura:** preto azulado (`oklch(0.16 0.015 265)`), surfaces em camadas, mesmo primary.
- **Tipografia:** Inter (UI) + Geist Mono (números/dados). Escala tight: 11/12/13/14/16/20/28/40. Tracking negativo em títulos.
- **Espaçamento:** densidade Linear (4/8/12/16/24/32/48). Cards com `border` sutil em vez de shadow pesada.
- **Raios:** 6/8/12 (nada de 16+). Botões `rounded-md`.
- **Microinterações:** `transition-all 150ms ease-out`, hover lift sutil, focus rings em primary/30.
- **Componentes premium:** rever Button, Card, Badge, Input, Dialog, Sheet, Tabs, Table, Tooltip — todos com variantes "premium" (ghost-elevated, gradient-subtle, glass).

Criar `src/components/ui/` extensions:
- `MetricCard` (número grande + delta + sparkline)
- `ActionCard` (recomendação IA com CTA inline)
- `EmptyState` premium
- `PageHeader` unificado (já existe — repolir)
- `CommandBar` (Cmd+K global estilo Linear/Attio)

---

## Fase 2 — Sidebar reorganizada (CRM-only)

Reescrever `src/components/app-sidebar.tsx` com a ordem exata pedida:

```
Dashboard
Carteira Comercial
Leads
Clientes
Oportunidades
Representantes
Agenda
WhatsApp
Marketing
Influencers
Geointeligência
IA Comercial
Relatórios
─────────────
Integrações ERP
Empresas
Usuários
Configurações
```

- Remover qualquer item com aparência de ERP (estoque, financeiro, fiscal — se existir).
- Separador visual entre bloco comercial e bloco de administração.
- Ícones Lucide consistentes (linha fina, 16px).
- Estado ativo: barra lateral primary + bg sutil.
- Collapsible "icon mode" com tooltips.
- Workspace switcher no topo (multiempresa).
- User menu no rodapé com avatar + status.

---

## Fase 3 — Revenue Command Center (`/dashboard`)

Substituir o dashboard atual por um **centro de ação**, não de indicadores:

Layout em grid 12 colunas:

1. **Hero:** "Bom dia, {nome}. Você tem **7 ações prioritárias** hoje." + barra de progresso de meta.
2. **Próximas ações (8 col):** lista priorizada vinda de `getNextBestAction` — cada linha tem cliente, motivo IA, CTA ("Agendar visita", "Enviar WhatsApp", "Ligar").
3. **Clientes em risco (4 col):** top 5 churn, com botão "Recuperar".
4. **Oportunidades quentes:** kanban mini horizontal.
5. **Representantes do dia:** ranking compacto.
6. **Campanhas ativas:** ROI inline.
7. **Sem compra recente:** lista com "Reativar".

Cada card termina com CTA. Nada é só número.

---

## Fase 4 — Customer 360 (`/companies/$id`)

A melhor tela do sistema. Layout split:

- **Coluna esquerda fixa (320px):** avatar/logo, nome, tags, scores IA (churn/recompra/LTV), dados de contato, dono, endereço com mini-mapa.
- **Centro (flex):** Tabs premium estilo Attio:
  - **Timeline** (default) — feed unificado: vendas ERP, WhatsApp, emails, visitas, atividades, mudanças. Filtros por tipo.
  - **WhatsApp** — conversa embedada.
  - **Emails** — thread.
  - **Visitas** — lista + mapa.
  - **Oportunidades** — kanban do cliente.
  - **IA Comercial** — painel com próxima melhor ação, previsões, recomendações de produto, comparativos.
- **Coluna direita (320px):** "Quick actions" sticky — Agendar, WhatsApp, Email, Nova oportunidade, Nota.

---

## Fase 5 — Connect Hub como assistente

Refatorar `/erp-connect/new` em **wizard de 6 passos** com linguagem zero técnica:

1. **Qual sistema você usa?** — grid de logos (TOTVS, SAP B1, Bling, Omie, Tiny, "Outro").
2. **Como conectamos?** — opções amigáveis ("Tenho um link/API", "Acesso direto ao banco", "Não sei" → abre chat com IA).
3. **Dados de acesso** — formulário curto com placeholder e exemplo. Senha mascarada. Botão "Onde encontro isso?" abre tooltip ilustrado.
4. **Testando conexão** — animação de loading + checks verdes/vermelhos em tempo real.
5. **IA validando** — "Encontramos 1.247 clientes, 89 representantes, 3 anos de histórico. Está correto?".
6. **Pronto!** — resumo + botão "Sincronizar agora" + agendamento automático.

Nenhuma palavra técnica visível (sem "host", "porta", "schema", "JDBC"). Tooltips e exemplos cuidam disso.

---

## Fase 6 — IA Comercial (`/inteligencia-comercial`)

Repolir a tela existente:
- Cada card de insight → CTA inline ("Agendar visita", "Criar campanha", "Atribuir representante").
- "AI do Dia" hero no topo: 3 ações destacadas com explicação curta da IA.
- Drawer de detalhe ao clicar: mostra o "porquê" da recomendação (sinais que pesaram).

---

## Fase 7 — Geointeligência (`/geo-rota`, `/geo-prospect`)

- Mapa fullscreen com sidebar flutuante (filtros + lista).
- Clusters por região (Mapbox-style com Leaflet.markercluster já instalado).
- Heatmap toggle (densidade de clientes / oportunidades / vendas).
- Pins coloridos por tipo: cliente ativo, em risco, prospect, oportunidade aberta.
- Click no pin → popup com mini Customer 360 + CTA "Adicionar à rota".
- Painel de rota: drag-and-drop de paradas + ETA + botão "Enviar para representante".

---

## Fase 8 — WhatsApp Inbox

Layout Intercom/HubSpot Inbox:
- **Coluna 1 (240px):** filtros (Não lidas, Atribuídas a mim, Aguardando, Todas) + tags.
- **Coluna 2 (320px):** lista de conversas com preview, hora, badge unread, avatar.
- **Coluna 3 (flex):** thread com bubbles modernas, suporte a mídia, quick replies, templates.
- **Coluna 4 (320px):** Customer 360 lateral do contato ativo + IA sugerindo resposta.

---

## Fase 9 — Telas restantes (refit visual)

Aplicar o novo design system em:
- **Leads / Clientes / Oportunidades:** tabelas estilo Attio (linhas finas, hover sutil, inline edit, colunas customizáveis, views salvas).
- **Pipeline:** kanban com cards densos, drag suave, preview hover.
- **Representantes:** ranking + perfil individual com mapa de cobertura.
- **Agenda:** calendário Linear-like + lista de hoje.
- **Marketing / Influencers / Relatórios:** cards e gráficos consistentes (Recharts com tema custom).
- **Empresas / Usuários / Configurações:** forms premium, settings em duas colunas.

---

## Fase 10 — Polish global

- **Command Bar (Cmd+K):** busca global + ações rápidas ("Novo lead", "Ir para cliente X", "Criar oportunidade").
- **Toasts:** Sonner reposicionado, ícones por tipo, undo inline.
- **Loading states:** skeletons que imitam layout real, nada de spinners genéricos.
- **Empty states:** ilustração + CTA claro em cada tela.
- **Theme toggle:** claro/escuro/sistema, persistente.
- **Accessibility:** focus visible, contraste AA, keyboard nav.

---

## Detalhes técnicos

- Stack inalterada: TanStack Start + Router, TanStack Query, Tailwind v4, shadcn/ui, Lucide, Recharts, Leaflet.
- Zero mudança em server functions, schemas, RLS ou regras de negócio.
- Tokens em `src/styles.css` (oklch). Nenhuma cor hard-coded em componentes.
- Rotas existentes preservadas; apenas componentes reescritos.
- `app-sidebar.tsx` é o único ponto de mudança de navegação.

---

## Ordem de execução sugerida

**1 → 2 → 3 → 4** (fundação + navegação + 2 telas-vitrine que provam o conceito) → **5 → 6 → 7 → 8** (módulos diferenciados) → **9 → 10** (consistência + polish).

Cada fase é entregável independente. Posso começar pela Fase 1+2 (design system + sidebar) que destrava o resto. Confirma?
