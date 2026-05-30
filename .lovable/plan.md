
# Plano: Refatoração e Evolução do USE CRM

O escopo deste prompt é gigantesco (auditoria completa + reorganização de sidebar + Customer 360 + Carteira Comercial + Central de Oportunidades + IA Comercial + Revenue Command Center + Health Score + Gestão de Representantes + Geointeligência + Marketing Intelligence + Influencer Intelligence + WhatsApp Enterprise + Omnichannel + Chat Interno + Alertas + Automações + Knowledge Center + ERP Connect Hub/Agent/Health). Isso são literalmente meses de trabalho — não cabe em uma única execução sem comprometer qualidade. Vou propor entregar em fases, começando pelas que dão maior alavancagem imediata.

## Fase 0 — Auditoria (entrega: relatório)
- Mapear todas as rotas em `src/routes/` e itens da sidebar atual
- Identificar telas/módulos com cara de ERP (financeiro, estoque, fiscal etc.) candidatos a remoção ou ocultação
- Identificar duplicações, fluxos quebrados, componentes redundantes
- Saída: documento markdown com lista de "manter / refatorar / remover / criar"

## Fase 1 — Reorganização estrutural (sem quebrar dados)
- Nova sidebar na ordem definida: Dashboard, Carteira Comercial, Leads, Clientes, Oportunidades, Representantes, Agenda, WhatsApp, Marketing, Influencers, Geointeligência, IA Comercial, Relatórios, Integrações ERP, Empresas, Usuários, Configurações
- Agrupar visualmente (Comercial / Relacionamento / Inteligência / Administração)
- Ocultar (não deletar dados) rotas com cara de ERP
- Redirecionar rotas antigas para os novos slugs

## Fase 2 — Revenue Command Center (novo Dashboard `/`)
Substitui o dashboard atual. Cards principais:
- Receita em risco
- Potencial identificado
- Clientes sem compra
- Oportunidades prioritárias
- Representantes com baixa cobertura
- Plano do dia / ações sugeridas
- Business Health Score (0–100)

Reaproveita queries já existentes (deals, companies, activities) e adiciona views derivadas onde necessário.

## Fase 3 — Customer 360
Página única `/clientes/$id` com abas: Visão Geral, Timeline, WhatsApp, Oportunidades, Campanhas, IA, Anotações. Consolida o que hoje está espalhado.

## Fase 4 — Carteira Comercial + Central de Oportunidades
- `/carteira`: tabela rica com filtros (representante, região, segmento, CNAE, canal, período) + score + última interação
- `/oportunidades`: buckets (recuperar / sem compra / recompra / upsell / cross-sell / territorial), priorização por IA

## Fase 5 — IA Comercial (copiloto)
Edge/server function usando Lovable AI (`google/gemini-3-flash-preview`) que recebe contexto comercial e responde "quem visitar / reativar / priorizar hoje". Widget no Dashboard + página `/ia`.

## Fase 6 em diante (escopo grande, depois)
Geointeligência (mapa + IA de rotas), Influencer Intelligence completo, WhatsApp Enterprise, Omnichannel, Chat interno, Motor de automações visuais, ERP Connect Hub + Agent local + Health Center, Benchmark multiempresa, Knowledge Center.

Cada uma dessas é um projeto por si só — vamos abordar uma de cada vez quando chegarmos lá.

## Como quero proceder

1. Começar **agora** pela **Fase 0 (auditoria)** + **Fase 1 (reorganização da sidebar e ocultação de menus ERP)**. São as bases para tudo o mais e já entregam clareza visível imediatamente.
2. Em seguida, na próxima rodada, atacar **Fase 2 (Revenue Command Center)** que é a tela que o usuário vê ao abrir o sistema.
3. Depois Customer 360, Carteira, Oportunidades, IA — uma por rodada.

## Perguntas antes de eu começar

1. **Confirma que posso ocultar (não deletar) rotas com cara de ERP** que eu identificar na auditoria? (financeiro, estoque, fiscal, NF-e etc. se existirem)
2. **Posso começar pelas Fases 0 + 1 nesta rodada** e deixar Revenue Command Center / Customer 360 / etc. para as próximas?
3. Há alguma tela atual que você considera **intocável** ou que já está boa e não quer que eu refatore?

Confirmando essas três, sigo com auditoria + nova sidebar imediatamente.
