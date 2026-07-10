# Auditoria de Rotas — USE CRM

Onda enxuta v3 (2026-07). Mapa de rotas potencialmente sobrepostas e recomendação de consolidação.
Meta: reduzir carga cognitiva sem regressão. Nenhuma remoção foi executada — este documento é o plano.

---

## 1. Dashboards (3 rotas concorrentes)

| Rota | Público | Status |
|---|---|---|
| `/dashboard` | Vendedor/operacional | **Manter** — Revenue Command Center + Growth Pulse + Central de Crescimento |
| `/dashboard-executivo` | C-level / gestor | **Avaliar consolidação** com `/use-success` |
| `/use-success` | C-level (novo) | **Manter** — índice USE Success 0-100 |
| `/gestao-visao-global` | Owner multiempresa | **Manter** — visão consolidada tenant |

**Ação sugerida**: transformar `/dashboard-executivo` em uma aba (`?view=executivo`) dentro de `/use-success`, ou redirecionar para `/use-success` se conteúdo for redundante. Requer revisão do conteúdo atual antes de mover.

---

## 2. Oportunidades / Pipeline (2 rotas)

| Rota | Escopo |
|---|---|
| `/pipeline` | Kanban de deals (fluxo padrão) |
| `/oportunidades` | Lista/centralizadora (nome duplicado) |

**Ação sugerida**: verificar se `/oportunidades` é apenas uma view alternativa. Se for, converter em rota pathless (`?view=list` em `/pipeline`) ou renomear para `/pipeline/lista`.

---

## 3. Automações (2 rotas)

| Rota | Escopo |
|---|---|
| `/automacoes` | UI comercial de automações |
| `/settings/automations` | Runs + configuração técnica |

**Ação sugerida**: manter separação (usuário vs. admin), mas garantir cross-link entre as duas.

---

## 4. Integrações (grande cluster)

Rotas atuais sob `/integrations/*`:
`advanced, agent, apps, conflicts, connect, connect.wizard, dashboard, diagnostic, health, help, mapping, outbox, smoke-test, templates`.

**Ação sugerida**: consolidar em 4 seções via layout `/integrations`:
- **Conectar** (`connect`, `connect.wizard`, `apps`, `templates`)
- **Saúde** (`dashboard`, `health`, `diagnostic`, `smoke-test`, `agent`)
- **Fluxo** (`mapping`, `outbox`, `conflicts`)
- **Avançado** (`advanced`, `help`)

Sub-rotas mantidas, apenas reagrupadas na sidebar do módulo (não requer renomear arquivos).

---

## 5. Geo (4 rotas — OK)

`/geo`, `/geo-rota`, `/geo-cobertura`, `/geo-prospeccao` — escopos distintos, **manter**.

---

## 6. Meu Dia vs. Dashboard vs. NBA (sobreposição)

| Rota | Escopo |
|---|---|
| `/dashboard` | Comando geral do rep |
| `/meu-dia` | Sequenciador de tarefas do dia |
| `/nba` | Next Best Action (fila) |

**Ação sugerida**: `/nba` e `/meu-dia` compartilham o mesmo objetivo (o que fazer agora). Considerar fundir `/nba` em uma aba de `/meu-dia`.

---

## 7. Retention / Win-Loss / Coaching (OK)

Escopos distintos e complementares, **manter**.

---

## Próxima onda recomendada

1. Fundir `/nba` em `/meu-dia` (menor risco).
2. Consolidar sidebar de `/integrations/*` (visual only, sem quebrar deep-links).
3. Decidir sobre `/dashboard-executivo` vs `/use-success`.

Nenhuma dessas ações requer migration; são refactors puros de rota/navegação.
