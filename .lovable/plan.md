# Plano: USE CRM → Plataforma de Inteligência Comercial

Este é um trabalho grande (semanas de execução). Vou propor um plano **faseado e priorizado** para entregarmos valor em ondas, sem tentar fazer tudo em uma única mensagem (o que destruiria a qualidade). Cada fase termina em algo navegável e testável.

## Princípio-mestre (aplicado em toda fase)
- **Nada de ERP**: estoque, fiscal, financeiro, NF, contas a pagar/receber, SPED, compras, produção, logística, RH ficam **fora**. Onde já existem telas dessas, marcamos como `ERP read-only` (banner já existe) ou removemos do menu principal.
- Toda feature responde: *gera lead? converte? aumenta venda? retém? melhora representante/marketing? identifica oportunidade?* Se não, não entra.

---

## Fase 1 — Auditoria + Limpeza da Sidebar (entrega imediata)
1. Auditar rotas em `src/routes/_app.*` e listar:
   - telas ERP-like (assets, banking, expenses, finance, invoices, products, stock, suppliers, sales-orders, subscriptions, contracts) → **remover do menu principal**, mover para grupo recolhido `Integrações ERP > Consulta` ou esconder.
   - duplicações (ex: `oportunidades` vs `opportunity-map`, `contacts` vs `companies` vs `carteira`).
2. Reorganizar `AppSidebar` na ordem oficial pedida:
   `Dashboard · Carteira · Leads · Clientes · Oportunidades · Representantes · Agenda · WhatsApp · Marketing · Influencers · Geointeligência · IA Comercial · Relatórios · Integrações ERP · Empresas · Usuários · Configurações`
3. Renomear "Empresas" para refletir **tenant/filial/unidade**, não cliente. Clientes = `Clientes` (companies de negócio).
4. Entregável: navegação enxuta, foco 100% comercial.

## Fase 2 — Revenue Command Center (novo Dashboard)
- Substituir `/dashboard` por painel com cards:
  - Receita em risco · Potencial identificado · Clientes sem compra · Oportunidades prioritárias · Cobertura representantes · Campanhas recomendadas · **Plano do dia** · Ações sugeridas.
- **Business Health Score** (0-100) no topo, com breakdown: crescimento, retenção, conversão, produtividade, recompra.
- Todos os widgets clicáveis → drill-down nas telas correspondentes.

## Fase 3 — Customer 360 turbinado
- `/clientes/$id` (ex-`/contacts/$id` e `/companies/$id` unificados em tabs):
  - Header: dados, segmento, CNAE, representante, ticket médio, frequência, última compra, score, health.
  - Tabs: Timeline · WhatsApp · Emails · Visitas · Reuniões · Notas · Campanhas · Oportunidades · IA (próximas ações).
  - Bloco "IA Comercial" sempre visível com 3 próximas ações sugeridas.

## Fase 4 — Carteira Comercial (a "tela principal")
- Filtros completos: representante, região, cidade, estado, segmento, CNAE, período, canal.
- Colunas: cliente, potencial, score, frequência, status relacionamento, última interação, buckets (risco/recompra/upsell/cross-sell).
- Ações em lote: campanha, sequência, atribuir representante, exportar.

## Fase 5 — Central de Oportunidades
- `/oportunidades` com **buckets**: recuperar, sem compra, recompra, upsell, cross-sell, territorial, por campanha.
- IA prioriza (score 0-100) e explica o "por quê".

## Fase 6 — Representantes + Geointeligência + IA de Rotas
- `/representantes`: carteira, visitas, metas, produtividade, conversão, cobertura, oportunidades.
- `/geointeligencia`: mapa com clientes, prospects, rotas, cobertura, potencial territorial.
- **IA de rotas**: ao montar visita, sugere prospects/clientes/oportunidades próximas baseado em CNAE/segmento/perfil dos melhores clientes.

## Fase 7 — Marketing Intelligence + Lead Scoring + Influencers
- Marketing: campanhas → leads → conversão → receita → ROI (já parcialmente existe, expandir).
- Lead scoring automático (potencial, interesse, compatibilidade, região, segmento).
- Influencer Intelligence: link exclusivo + LP + cupom + métricas (leads, vendas, ROI).

## Fase 8 — WhatsApp Enterprise + Omnichannel + Chat interno
- WhatsApp: multiatendimento, histórico, follow-up, campanhas, automações (base já existe).
- Omnichannel: Instagram, Facebook, TikTok, LinkedIn, Email, Chat — tudo no Customer 360.
- Chat interno corporativo.

## Fase 9 — Multiempresa / Benchmark / ERP Connect Hub
- Modo Individual / Consolidado / Comparativo entre tenants/filiais.
- Benchmark com IA (melhores práticas, gargalos).
- ERP Connect Hub: wizard 6 passos (selecionar ERP → método → testar → IA detecta → validar → sincronizar).
- ERP Health Center (online/offline/última sync/erros).
- Agent local (Windows/Linux) — apenas **especificação** nesta fase; build do binário é fora do escopo desta plataforma web.

## Fase 10 — Automações + Alertas + Knowledge Center
- Motor visual SE/ENTÃO.
- Alertas matinais (07:30) por papel.
- IA aprende com histórico e recomenda.

---

## Como vou executar
- **Uma fase por mensagem** (algumas grandes podem virar 2 mensagens). Você aprova/ajusta no fim de cada fase antes de eu seguir.
- Em cada fase: edito código, mantenho RLS/multitenant, uso tokens do design system, sem alterar regras de segurança aceitas.
- Tudo no padrão TanStack Start + `createServerFn` + Supabase (Lovable Cloud) já em uso.

## Próximo passo proposto
Começar pela **Fase 1 (Auditoria + Sidebar)** — é a base que destrava todas as outras e já entrega a sensação de "CRM, não ERP". Posso começar agora?
