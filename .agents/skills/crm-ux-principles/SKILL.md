---
name: crm-ux-principles
description: Princípios de UX/UI do USE CRM. Use em qualquer trabalho de interface, design, layout, componentes visuais ou fluxos de tela.
---

# CRM UX — princípios

Interface **simples, elegante e orientada à ação**. Sensação de SaaS premium — inspirado em
HubSpot, Attio, Linear, Salesforce Lightning, mas com identidade própria (paleta e tipografia
já definidas no projeto: NUNCA reverter para default AI aesthetic).

## Regras
- Menos cliques, menos campos.
- Linguagem simples (pt-BR, direta, sem jargão técnico exposto ao usuário).
- Navegação intuitiva e consistente entre módulos.
- Design consistente — usar tokens semânticos de `src/styles.css`, nunca cores hardcoded.
- Feedback imediato (toasts, estados de loading, optimistic UI quando seguro).
- Componentes shadcn/ui como base; hover/estado focus refinado (ver padrão de sidebar já implementado).
- Mobile-friendly onde faz sentido (bottom nav já existe).

## Customer 360
Um vendedor deve compreender a situação do cliente **em menos de 1 minuto**. Reunir em uma
única visão: cadastro, contatos, histórico comercial, interações, WhatsApp, emails, visitas,
oportunidades, campanhas, recomendações de IA.

## Nunca
- Cores hardcoded (`text-white`, `bg-[#...]`) — quebra tema.
- Fontes genéricas (Inter/Poppins) se o projeto já define outras.
- Gradientes roxo/índigo padrão de AI slop.
- Layouts intercambiáveis hero/nav/footer sem personalidade.
