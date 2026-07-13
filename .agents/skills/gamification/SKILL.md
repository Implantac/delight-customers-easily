---
name: gamification
description: Gamificação comercial — leaderboards, badges, goals, achievements, sales competitions. Ler ao mexer em /goals, ranking, comissões, motivação de time comercial.
---

# Gamification

## Princípio
Gamificar o **comportamento produtivo**, não a métrica final (receita). Motivar sem virar joguinho de escola.

## Elementos

### Leaderboards
- Por período (dia/semana/mês/trimestre)
- Por métrica (won, atividades, novos deals, taxa de resposta)
- Segmentado (por time, filial, produto)
- Visível para o próprio rep e para o gestor
- **Nunca** apenas por receita bruta (favorece contas grandes/sorte)

### Badges / Achievements
Exemplos:
- **First blood** — primeiro deal ganho
- **Streak** — 10 dias com atividade
- **Marathon** — 100 calls no mês
- **Multithreader** — deal com 5+ contatos
- **Recovery** — recuperou deal parado
- **Explorer** — abriu nova região/segmento

Cada badge com raridade (bronze/prata/ouro/platina).

### Goals (metas)
- **Individuais** (`sales_goals`) — valor + count
- **De time** — soma dos individuais
- **Organizacionais** — meta agregada
- Progresso visível em tempo real
- Alerta ao atingir 25/50/75/100%
- Celebrar 100% (confetti, notificação para todos)

### Sales competitions (temporárias)
- Campanha de 2 semanas: "quem fechar mais em X"
- Prêmio claro
- Regras publicadas
- Progresso atualizado diário
- Encerramento com cerimônia (mesmo virtual)

## Design UX
- **Não** poluir tela principal com badges piscando
- Ranking visível em página dedicada + widget opcional no dashboard
- Notificação sutil ao ganhar badge (não interromper)
- Perfil do rep mostra badges conquistados (opt-in mostrar aos colegas)

## Comissões (`commission_rules`, `commission_payouts`)
Diferente de gamificação, mas relacionado:
- Regras transparentes e simuláveis (rep vê "se eu ganhar esse deal, ganho X")
- Cálculo automático + auditável
- Aprovação pelo gestor antes de payout
- Report histórico

## Anti-manipulação
- Gamificação não vale ação viciosa (registrar atividade falsa, mover deal artificialmente)
- Detectar padrões suspeitos (100 tasks marcadas em 1 min)
- Métrica de qualidade (ex.: atividade com resultado) além de quantidade

## Cultura
- Envolver time na definição das metas e prêmios
- Celebrar esforço, não só resultado
- Rotacionar tipos de competição (evitar sempre a mesma pessoa ganhar)

## Antipatterns
- Ranking público que humilha os últimos
- Badge por métrica sem valor real
- Meta impossível (desmotiva)
- Meta fácil demais (perde credibilidade)
- Gamificação em vez de coaching (não substitui)
