
# Refatoração USE CRM → Plataforma de Inteligência Comercial

O escopo é gigante (70+ rotas, 9 pilares, IA, ERP Connect, multiempresa, omnichannel). Impossível entregar em um único turno sem quebrar o sistema. Proponho **8 fases incrementais**, cada uma testável e reversível. Você aprova fase a fase — eu não avanço sem seu "ok prossiga".

Já concluímos:
- ✅ Fases 1–8 (sidebar, Customer 360, Revenue CC, IA Comercial, Carteira, Multiempresa, ERP Connect, Geo + Marketing)
- ✅ Fase 9 — Hardening de performance (índices compostos em deals/activities/invoices/tickets/contacts/companies)

## Princípio-guia (vale para tudo)

Toda feature precisa responder SIM a pelo menos uma:
vende mais? acha oportunidade? aumenta produtividade? melhora relacionamento? ajuda gestor a decidir?
Se não → fica fora do menu (ou vira leitura no ERP Connect).

---

## FASE 4 — IA Comercial Unificada *(próxima)*

Consolidar `ai-insights`, `copilot`, `coaching`, `playbooks`, `churn`, `lead-scoring`, `forecast` numa **suíte IA Comercial** com 4 agentes:
- **Follow-up Agent** — quem ligar/visitar hoje, com roteiro
- **Opportunity Agent** — upsell, cross-sell, reativação (usa curva ABC do cliente)
- **Risk Agent** — churn, inadimplência, queda de frequência
- **Rep Agent** — ranking de representantes, gaps de cobertura

Cada agente: o que detectou → por quê → ação sugerida → aceitar/agendar/dispensar.
Backend: `createServerFn` + Lovable AI Gateway (`google/gemini-3-flash-preview`).

## FASE 5 — Carteira Comercial Inteligente + Sales Intelligence

Nova rota `/carteira` (atual `/companies` fica como fallback). Tabela densa com:
- Filtros: representante, região, cidade, estado, CNAE, segmento, canal
- Colunas: última compra, ticket médio, frequência, score comercial, status relacionamento, potencial
- Ações em massa: criar campanha, atribuir representante, exportar lista
- Tabs de Sales Intelligence: "Visitar hoje", "Reativar", "Em risco", "Sem contato 30d+", "Inadimplentes"

## FASE 6 — Multiempresa / Holding + Benchmark

- Modelo de **grupo empresarial**: organization pode ter `parent_org_id` (holding → filiais)
- Seletor no header: **Individual | Consolidado | Comparativo**
- Tela `/benchmark`: comparação entre unidades (conversão, ticket, retenção, crescimento)
- IA aponta melhor unidade por métrica e sugere replicação de práticas

Migração: nova coluna `parent_org_id` + RLS atualizada via `is_org_member` recursivo.

## FASE 7 — ERP Connect Hub Universal

Refatorar `/integrations` em wizard de 7 passos:
1. Escolher ERP (Omie, Bling, Tiny, SAP, Protheus, custom)
2. Método (API / DB / Agent local / CSV / XML)
3. Testar conexão
4. IA detecta estrutura (mapa de tabelas/colunas)
5. IA sugere mapeamentos campo-a-campo
6. Validar amostra
7. Sincronizar

Mais: **Health Center** (`/erp/health`) com status online/offline, latência, última sync, conflitos, fila de eventos, auditoria.
Sincronização bidirecional com resolução de conflitos (last-write-wins por campo, com override manual).

*ERP Connect Agent (Windows/Linux) fica como entregável separado — só web nesta fase.*

## FASE 8 — Geointeligência + IA de Rotas + Marketing/Influencers

- `/geo` com mapa de clientes, representantes, prospects, rotas, cobertura
- IA de Rotas: ao montar visita, busca clientes/prospects próximos por CNAE e perfil de melhores clientes
- Marketing Intelligence: captura de leads de WhatsApp/Instagram/Facebook/TikTok/LinkedIn/LP/Google Business
- Influencer Intelligence: link/cupom/LP exclusivos por influencer + ROI vs. outros canais

## FASE 9 — Polimento Enterprise

- WhatsApp Enterprise (multiatendimento, campanhas, templates) — já existe parcial, consolidar
- Omnichannel unificado no Customer 360
- Automações visuais (SE → ENTÃO) sem código
- Alertas programados (07:30 representante recebe rota; gestor recebe receita em risco)
- Modo claro / escuro como preferência de usuário (paleta atual preservada)
- Hardening: MFA, auditoria LGPD, RBAC granular, índices/paginação/lazy loading

---

## Detalhes técnicos

- **Stack**: TanStack Start + Supabase + Lovable AI Gateway (já configurado)
- **RLS**: tudo passa por `is_org_member(org, auth.uid())`; multiempresa adiciona check recursivo via `parent_org_id`
- **IA**: server functions com `requireSupabaseAuth`; modelo padrão `google/gemini-3-flash-preview` (rápido e barato); upgrade para `gemini-2.5-pro` em análises pesadas
- **Sem mocks**: tudo lê dados reais do Supabase; quando vazio, mostra empty state com CTA
- **Identidade visual**: paleta atual mantida; só refinamentos de densidade e hierarquia
- **Rotas existentes**: nenhuma deletada nesta etapa; apenas escondidas do nav ou reagrupadas

---

## Próximo passo

Confirma que avançamos com a **Fase 4 (IA Comercial Unificada)** agora? Ou prefere reordenar (ex: pular para Fase 6 multiempresa, ou Fase 7 ERP Connect primeiro)?
