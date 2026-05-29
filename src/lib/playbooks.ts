// Playbooks: próximas ações recomendadas por estágio do deal.
// Puro — sem chamadas ao banco.

export type PlaybookStep = {
  title: string;
  description: string;
  channel: "email" | "whatsapp" | "call" | "meeting" | "internal";
  template?: string;
};

export type Playbook = {
  stage: string;
  label: string;
  goal: string;
  steps: PlaybookStep[];
};

export const PLAYBOOKS: Record<string, Playbook> = {
  lead: {
    stage: "lead",
    label: "Lead",
    goal: "Qualificar interesse e agendar conversa de descoberta.",
    steps: [
      {
        title: "Mensagem de abertura personalizada",
        description: "Reference o setor/empresa e proponha 15 min de conversa.",
        channel: "email",
        template:
          "Olá {{first_name}}, vi que a {{company}} atua em {{industry}}. Ajudamos empresas parecidas a {{value_prop}}. Topa 15 min essa semana?",
      },
      {
        title: "Follow-up em 48h se sem resposta",
        description: "Toque rápido com 1 case relevante.",
        channel: "whatsapp",
        template: "Oi {{first_name}}, segue um case rápido: {{case_link}}. Posso te ligar amanhã às 10h?",
      },
      {
        title: "Pesquisar contexto",
        description: "Olhar site, LinkedIn e últimas notícias antes da call.",
        channel: "internal",
      },
    ],
  },
  qualified: {
    stage: "qualified",
    label: "Qualificado",
    goal: "Mapear dor, decisor e orçamento — preparar proposta.",
    steps: [
      {
        title: "Call de diagnóstico (30 min)",
        description: "Use o roteiro SPIN: Situação, Problema, Implicação, Necessidade.",
        channel: "meeting",
      },
      {
        title: "Resumo + próximos passos",
        description: "Envie por escrito o que foi acordado e a data da proposta.",
        channel: "email",
        template:
          "{{first_name}}, obrigado pela conversa. Resumindo: {{summary}}. Vou enviar a proposta até {{deadline}}.",
      },
      {
        title: "Identificar comitê de decisão",
        description: "Quem aprova? Quem influencia? Quem usa?",
        channel: "internal",
      },
    ],
  },
  proposal: {
    stage: "proposal",
    label: "Proposta",
    goal: "Apresentar proposta com valor claro e gerar urgência.",
    steps: [
      {
        title: "Enviar proposta com vídeo de 2 min",
        description: "Vídeo explicando ROI aumenta resposta em 3x.",
        channel: "email",
        template:
          "{{first_name}}, segue a proposta. Gravei um vídeo curto explicando o racional: {{video_link}}. Validade: {{valid_until}}.",
      },
      {
        title: "Confirmar recebimento em 24h",
        description: "Ligue para garantir que abriu e tirar dúvidas.",
        channel: "call",
      },
      {
        title: "Agendar reunião de fechamento",
        description: "Não deixe a proposta morrer na caixa de entrada.",
        channel: "meeting",
      },
    ],
  },
  negotiation: {
    stage: "negotiation",
    label: "Negociação",
    goal: "Remover objeções e fechar com termos saudáveis.",
    steps: [
      {
        title: "Listar objeções por escrito",
        description: "Preço, prazo, escopo, risco — endereçar uma por uma.",
        channel: "internal",
      },
      {
        title: "Proposta revisada com concessões controladas",
        description: "Nunca dê desconto sem contrapartida (prazo, volume, exclusividade).",
        channel: "email",
      },
      {
        title: "Definir data de assinatura",
        description: "Compromisso explícito de data. Sem data, não há fechamento.",
        channel: "call",
      },
    ],
  },
  won: {
    stage: "won",
    label: "Ganho",
    goal: "Onboarding rápido e abrir caminho para expansão.",
    steps: [
      {
        title: "Kick-off em até 5 dias úteis",
        description: "Agende reunião de início com cliente e equipe interna.",
        channel: "meeting",
      },
      {
        title: "Solicitar indicação / case",
        description: "Aproveite o momento de entusiasmo para pedir 2 indicações.",
        channel: "email",
      },
    ],
  },
  lost: {
    stage: "lost",
    label: "Perdido",
    goal: "Aprender com a perda e manter porta aberta.",
    steps: [
      {
        title: "Registrar motivo da perda",
        description: "Preço, timing, concorrente, no-decision — categorize.",
        channel: "internal",
      },
      {
        title: "Follow-up em 90 dias",
        description: "Status mudou? Concorrente cumpriu? Pode reabrir.",
        channel: "email",
      },
    ],
  },
};

export function playbookFor(stage: string): Playbook {
  return PLAYBOOKS[stage] ?? PLAYBOOKS.lead;
}

export function fillTemplate(tpl: string, vars: Record<string, string | undefined>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
