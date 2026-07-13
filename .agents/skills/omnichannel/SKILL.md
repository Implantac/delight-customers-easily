---
name: omnichannel
description: WhatsApp Business, Instagram, Facebook, TikTok, LinkedIn, email, chat, telefone/VoIP — todos convergindo ao Customer 360. Ler ao mexer em canais de comunicação, /whatsapp, /chat, campanhas, inbox unificado.
---

# Omnichannel

## Princípio
**Uma inbox, uma timeline, um contexto**. Cliente escreve por qualquer canal → aparece no Customer 360 e na inbox do rep responsável, com histórico.

## Canais e status no USE CRM

| Canal | Status | Notas |
|---|---|---|
| **WhatsApp Business** | Implementado (`whatsapp_channels`) | Cloud API Meta; templates aprovados; janela 24h |
| **Email (transacional/inbound)** | Parcial (`/api/public/inbound-email`) | Depende de domínio verificado |
| **Chat site** | Implementado (`site-chat`) | Widget JS embeddável |
| **Instagram/FB DM** | Não — exige connector + app Meta | Usuário precisa fornecer credenciais |
| **TikTok / LinkedIn DM** | Não — API restrita | Roadmap com connector |
| **VoIP / Ligação** | Não — click-to-call apenas | Integração Zenvia/Twilio futura |

## Padrões

### Inbox unificada
Lista única com filtros (canal, status, owner, SLA). Cada conversa mostra ícone do canal, último autor, snippet, unread count.

### Timeline por cliente
Merge cronológico de mensagens de todos os canais no Customer 360.

### Templates (`message_templates`)
Reutilizáveis, com variáveis (`{{first_name}}`, `{{deal_value}}`), aprovados no WhatsApp quando fora da janela 24h.

### SLA (`whatsapp_sla_policies` + análogos)
Primeira resposta / próxima resposta / resolução. Alerta visível quando estourar.

### Cadências mistas (`sequences`)
Passos em canais diferentes (email → wa → call). **Pausa automática** ao receber resposta (`pause_sequences_on_wa_reply` já implementado). Nunca reenviar após opt-out.

### Attribution
Toda conversa iniciada guarda `source_kind` (campanha, landing, cold outbound, referral) para calcular ROI.

## WhatsApp Business (específico)
- **Janela de 24h**: fora dela, só templates aprovados
- **Opt-in obrigatório** (LGPD)
- **Rate limit** por número (evitar bloqueio Meta)
- **Fila** (`whatsapp_outbox`) com retry, backoff, e DLQ
- **Webhook** (`/api/public/hooks/whatsapp-webhook.$channelId`) assinado
- **Summary por IA** (resumo da conversa para o rep entrar sem ler tudo)

## Email
- **Domain verification** (SPF, DKIM, DMARC) — usuário configura no DNS
- **Reply-to routing** (email volta para o mesmo deal/lead)
- **Unsubscribe automático** (LGPD)

## Voz (futuro)
Quando entrar VoIP:
- Click-to-call desde o card do contato
- Gravação com consentimento
- Transcrição + resumo por IA
- Extração de tarefas mencionadas na call
- Sentimento

## Integração ao NBA
Mensagens não respondidas > SLA → NBA "responder cliente X".
Buying signals detectados na conversa → boost no deal score.
Detractor no NPS → tarefa imediata para CSM.

## Antipatterns
- Canais isolados sem timeline unificada (rep não sabe o histórico)
- Templates rígidos sem variáveis (soam robóticos)
- Enviar campanhas sem respeitar opt-out
- Bot que não passa para humano quando pedido
