// Utilitários client-side do ConnectHub: catálogo amigável + tradução de erros.

export type FriendlyErp = {
  id: string;
  name: string;
  logo: string; // emoji ou inicial
  blurb: string;
  // método principal sugerido
  recommended: "api-omie" | "api-bling" | "custom" | "soon";
};

export const FRIENDLY_ERPS: FriendlyErp[] = [
  { id: "omie", name: "Omie", logo: "🟢", blurb: "ERP em nuvem. Conecte com App Key e App Secret.", recommended: "api-omie" },
  { id: "bling", name: "Bling", logo: "🔵", blurb: "ERP em nuvem. Conecte com seu Access Token.", recommended: "api-bling" },
  { id: "tiny", name: "Tiny", logo: "🟡", blurb: "ERP em nuvem. Use planilha ou webhook por enquanto.", recommended: "custom" },
  { id: "contaazul", name: "Conta Azul", logo: "🔷", blurb: "ERP em nuvem. Use planilha ou webhook por enquanto.", recommended: "custom" },
  { id: "totvs", name: "TOTVS", logo: "🔶", blurb: "ERP corporativo. Use Agente Local (em breve) ou planilha.", recommended: "soon" },
  { id: "sankhya", name: "Sankhya", logo: "🟣", blurb: "ERP corporativo. Use Agente Local (em breve) ou planilha.", recommended: "soon" },
  { id: "senior", name: "Senior", logo: "⚫", blurb: "ERP corporativo. Use Agente Local (em breve) ou planilha.", recommended: "soon" },
  { id: "custom", name: "ERP personalizado", logo: "🧩", blurb: "Qualquer outro ERP. Use webhook ou planilha.", recommended: "custom" },
];

// Traduz mensagens de erro técnicas em frases amigáveis (fallback antes da IA).
export function translateError(raw: string): string {
  const s = (raw || "").toLowerCase();
  if (!s) return "Algo deu errado. Tente novamente.";
  if (s.includes("unauthorized") || s.includes("401") || s.includes("invalid_token") || s.includes("denied"))
    return "Suas credenciais parecem incorretas. Verifique a chave de acesso e a senha.";
  if (s.includes("403") || s.includes("forbidden"))
    return "O ERP recusou o acesso. Pode ser falta de permissão para a chave usada.";
  if (s.includes("404") || s.includes("not found"))
    return "O endereço do ERP não foi encontrado. Confira se o ERP está correto.";
  if (s.includes("timeout") || s.includes("timed out") || s.includes("etimedout"))
    return "O ERP demorou muito para responder. Verifique sua internet ou se o ERP está fora do ar.";
  if (s.includes("enotfound") || s.includes("dns") || s.includes("getaddrinfo"))
    return "Não localizamos o servidor do ERP. Verifique o endereço informado.";
  if (s.includes("network") || s.includes("fetch failed"))
    return "Não conseguimos chegar ao ERP. Verifique sua conexão com a internet.";
  if (s.includes("faultstring"))
    return "O ERP retornou um aviso. Verifique se as credenciais estão ativas.";
  return "Não conseguimos conectar ao seu ERP. Tente novamente ou peça ajuda.";
}

export function statusLabel(s: string): { label: string; tone: "green" | "yellow" | "red" | "gray" } {
  switch (s) {
    case "online": return { label: "Conectado", tone: "green" };
    case "degraded": return { label: "Precisa de atenção", tone: "yellow" };
    case "offline": return { label: "Desconectado", tone: "red" };
    default: return { label: "Nunca sincronizado", tone: "gray" };
  }
}
