---
name: crm-ux-premium
description: Padrões UX de CRMs premium modernos — Attio, Linear, Notion, Stripe, Vercel, HubSpot, Pipedrive, Monday. Interações, layouts, densidade, atalhos, command palette. Ler antes de criar/refatorar telas.
---

# CRM UX Premium

## Referências (estudar comportamento, não copiar visual)
- **Attio** — datagrid rico, records flexíveis, colaboração inline
- **Linear** — velocidade, atalhos, command menu, transições sutis
- **Notion** — flexibilidade, slash commands, drag-and-drop universal
- **Stripe** — clareza, densidade equilibrada, docs integradas
- **Vercel** — minimalismo funcional, states bem cuidados
- **HubSpot** — familiar, side panels, associations claras
- **Pipedrive** — foco no pipeline, drag simples
- **Monday** — flexibilidade visual, boards coloridos (evitar excesso)

## Princípios (aplicar sempre)

### 1. Velocidade percebida
- **Optimistic UI** para toda ação simples (mover deal, marcar task, editar campo inline)
- **Skeleton** ≠ spinner (skeleton mostra estrutura, spinner é última opção)
- **Prefetch** em hover de link (TanStack Router já suporta)
- Rota mudou → transição < 200ms

### 2. Densidade equilibrada
- Não é "muito espaço branco" nem "planilha apertada"
- Font base 14px, headings 16-24px
- Linha da tabela ~40-44px (não 60px)
- Padding de card 16-24px

### 3. Command Palette (Cmd+K)
Toda ação principal acessível: criar deal, buscar cliente, navegar, quick add. `command-palette` já existe — sempre estender.

### 4. Atalhos de teclado
- `g d` → dashboard, `g p` → pipeline, `g c` → contatos (já implementado)
- `c` → criar (contextual à página)
- `/` → foco na busca
- `?` → help de atalhos

### 5. Inline edit
Clique no valor de uma célula → edita in-place. Sem modal para tarefas triviais.

### 6. Side panels vs modals
- **Modal**: ação transacional pequena (confirmar delete, criar rápido)
- **Side panel (Sheet)**: ver/editar detalhes sem perder contexto
- **Rota**: fluxo com múltiplos passos ou compartilhável

### 7. Empty states com CTA
Nunca mostrar tela vazia. Sempre: ícone + 1 frase + 1 CTA + link para aprender.

### 8. Feedback consistente
- Toast (`sonner`) para confirmação (2-3s)
- Toast de erro com ação (retry / desfazer)
- Undo em ações destrutivas (10s)

### 9. Cores semânticas (tokens do projeto)
NUNCA hardcode. Sempre `bg-primary`, `text-muted-foreground`, `border-border`, `bg-destructive/10`, etc.
Ver `mem://` para paleta definida.

### 10. Dark mode nativo
Todo componente testado em light + dark. Nunca cor fixa que quebra em um dos modos.

### 11. Mobile-friendly onde faz sentido
CRUD principal deve ter bottom nav. Pipeline complexo pode ser desktop-only, mas informar.

### 12. Animações
Sutis, funcionais, < 300ms. Nunca decorativas. `framer-motion` com curvas suaves (`ENTERPRISE_TRANSITION` já definido).

## Antipatterns (não fazer)
- Sidebar com 30 itens sem grupos
- Modal em cima de modal
- Formulário com 20 campos obrigatórios
- Loading skeleton em cima de dados já em cache
- Cores decorativas sem significado
- Fonte Inter/Poppins default (AI slop)
- Gradiente roxo/índigo genérico
- Emoji no lugar de ícones sérios
- "Loading..." em texto solto
- Tooltip que precisa clicar para abrir

## Personalidade USE CRM
Elegante, direto, confiável, brasileiro (pt-BR nativo, sem "resource"/"leverage"). Sensação de premium SaaS mas familiar para vendedor brasileiro de PME/mid-market.
