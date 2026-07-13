---
name: mobile-crm
description: Field sales / mobile CRM — offline-first, GPS check-in, rotas, voz, WhatsApp nativo, PWA. Ler ao mexer em experiência mobile, campo, visitas, /meu-dia mobile, PWA.
---

# Mobile CRM (Field Sales)

## Contexto
Rep de campo trabalha **no carro, no cliente, sem sinal, com 30 seg entre uma visita e outra**. Mobile CRM tradicional falha aqui — vira burocracia pós-visita.

## Princípios
1. **Offline-first** — funciona sem rede, sincroniza quando volta
2. **Voice-first** — falar > digitar no campo
3. **Contextual** — mostra o que interessa AGORA, não a base inteira
4. **1 tap actions** — check-in, próxima visita, WhatsApp

## Meu Dia (tela principal mobile)
Sequência do dia com:
- Próxima visita (endereço, contato, contexto do cliente em 3 linhas)
- Botão "iniciar rota" (Waze/Google Maps deep link)
- Botão "check-in" (grava lat/lng + timestamp)
- Botão "WhatsApp" (abre chat com template)
- Após visita: notas por voz + próxima ação

## Check-in geolocalizado
- GPS ao chegar no cliente (`checkin-button` já existe)
- Registro de horário e coordenadas
- Foto opcional (comprovante de visita)
- Vincula à atividade / deal
- Anti-fraude: comparar lat/lng do check-in com endereço cadastrado

## Rotas (`geo-rota`)
- Baixadas na noite anterior
- Reordenáveis com drag
- Otimização com IA (`optimizeRouteWithAI`)
- Cada parada mostra: contexto, objetivo, tempo estimado, próxima ação sugerida
- Deep link para navegação externa

## Voz
- Notas pós-visita por voz → transcrição por IA → resumo estruturado
- Comando "criar tarefa: ligar para João amanhã"
- Comando "atualizar deal X para negociação"

## WhatsApp nativo (não copy/paste)
- Deep link `wa.me` com template pré-preenchido
- Chat aparece na timeline do cliente (via webhook Meta)
- Rep responde no WhatsApp normal — CRM captura

## Offline
- Cache de meu dia + contatos visitados hoje (IndexedDB)
- Fila local de mudanças (check-ins, notas, tarefas)
- Sync ao voltar rede (background sync API quando suportado)
- Indicador visível de "offline / sincronizando / sincronizado"

## PWA
- Instalável (`pwa-install-banner` já existe)
- `manifest.webmanifest` + ícones
- Service Worker para cache de shell + assets
- Push notifications (com opt-in) para leads quentes, mensagens

## Bottom nav (mobile only)
5 destinos máximos: Meu Dia, Rota, Contatos, Pipeline, Mais. Nunca menu hamburguer para navegação principal.

## Formulários
- Autocomplete agressivo
- Teclado numérico/email/tel correto
- Sem obrigatoriedade excessiva
- Salvar rascunho automático

## Bateria e dados
- Não fazer polling agressivo
- Realtime só quando app em foreground
- Imagens comprimidas antes de upload
- Video/áudio opcional

## Antipatterns
- Requerer sinal constante
- Formulário longo pós-visita
- Menu principal escondido
- Modal em vez de bottom sheet
- Botões pequenos (< 44px touch target)
- Requer login toda vez que abre
