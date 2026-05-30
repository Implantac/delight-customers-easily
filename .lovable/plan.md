# Plano: USE CRM — Refatoração em Modo Inteligência Comercial

O escopo do prompt é gigantesco (≈30 frentes). Tentar entregar tudo em uma rodada produziria um resultado raso e quebraria o app. Proponho dividir em **6 ondas entregáveis**, cada uma fechada em si, começando pelas que dão maior salto percebido.

---

## Princípio guia (aplicado em todas as ondas)

CRM ≠ ERP. Antes de qualquer mudança, cada tela/rota será avaliada por uma única pergunta:

> "Isso ajuda a gerar lead, converter, vender mais, reter, gerenciar representante ou achar oportunidade?"

Se não, é candidata a remoção, ocultação ou movimentação para "Integrações ERP" (somente leitura/consulta).

---

## Onda 1 — Auditoria + Reorganização da Sidebar (esta rodada)

**Entrega:**
1. **Relatório de auditoria** (`docs/audit-crm.md`) listando, rota por rota: papel, status (manter / mover / remover / fundir), justificativa comercial.
2. **Nova sidebar** com a estrutura proposta:
   Dashboard · Carteira · Leads · Clientes · Oportunidades · Representantes · Agenda · WhatsApp · Marketing · Influencers · Geointeligência · IA Comercial · Relatórios · Integrações ERP · Empresas · Usuários · Configurações.
3. Rotas com cara de ERP (estoque, suppliers, expenses, banking, invoices, sales-orders, finance, products, stock, contracts internos) movidas para um grupo recolhido **"Integrações ERP (consulta)"** — não removidas ainda, apenas despromovidas, para evitar quebra.
4. Itens claramente redundantes (ex.: duas telas que fazem a mesma coisa) fundidos.

Sem migração de dados nesta onda — só navegação e UX.

## Onda 2 — Revenue Command Center (novo Dashboard)

Substitui o dashboard atual por um painel "o que fazer hoje":
- Receita em risco · Potencial identificado · Clientes sem compra · Oportunidades prioritárias · Representantes com baixa cobertura · Plano do dia · Ações sugeridas pela IA.
- Business Health Score (0–100) consolidando crescimento, retenção, conversão, produtividade, recompra.

Reusa funções já existentes (`recommendations`, `business-health`, `forecast`, `churn`) — só agrega.

## Onda 3 — Customer 360 + Carteira Comercial

- **Customer 360**: tela única do cliente com timeline omnichannel (WhatsApp, email, visitas, campanhas, oportunidades, IA).
- **Carteira Comercial** com filtros (representante, região, segmento, CNAE, canal) + score/potencial/última interação.

## Onda 4 — Central de Oportunidades + Sales Intelligence

Agrega em um módulo: recuperação, sem-compra, recompra, upsell, cross-sell, territoriais, por campanha. IA prioriza. Responde "quem visitar / reativar / priorizar hoje".

## Onda 5 — Representantes + Geointeligência + IA de Rotas

Módulo de gestão de representantes (carteira, metas, cobertura, produtividade) + mapa comercial + IA que sugere prospects/clientes próximos a uma visita.

## Onda 6 — Marketing & Influencer Intelligence + Multiempresa/Benchmark

- Marketing unificado a comercial (campanhas → leads → receita → ROI).
- Influencer Intelligence (link, LP e cupom exclusivos por influenciador — boa parte já existe, faltam métricas consolidadas).
- Modos Individual / Consolidado / Comparativo entre empresas + benchmark IA.

---

## Detalhes técnicos da Onda 1 (a executar agora)

**Arquivos afetados (estimado):**
- `src/components/app-sidebar.tsx` — reescrever grupos/itens conforme nova IA.
- `src/components/mobile-bottom-nav.tsx` — ajustar para refletir top-level.
- `src/components/command-palette.tsx` — atualizar atalhos para nomes novos.
- `docs/audit-crm.md` (novo) — auditoria escrita.
- Nenhuma rota será deletada nesta onda (zero risco de 404). Rotas ERP-like apenas reagrupadas sob "Integrações ERP".
- Nenhuma migração de banco.

**Critérios de aceite:**
- Sidebar exibe os 17 itens na ordem proposta, agrupados em seções (Comercial · Engajamento · Inteligência · Configuração).
- Grupo "Integrações ERP (consulta)" recolhido por padrão.
- Todas as rotas atuais ainda acessíveis (sem links quebrados).
- Documento de auditoria entregue em `docs/audit-crm.md`.

---

## Confirmação necessária

Responda apenas com o número da onda para começar (ou "1" para seguir o plano):

1. Executar **Onda 1** agora (auditoria + sidebar) — recomendado.
2. Pular auditoria e ir direto para **Onda 2** (Revenue Command Center).
3. Outra ordem — me diga qual onda priorizar.
