import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org";

/**
 * Sinais comerciais do dia — consulta compartilhada entre o painel
 * "O que preciso fazer hoje?" e o Copiloto de Briefing.
 * Somente leitura. Não executa nada.
 */
export type DailySignals = {
  overdue: number;
  dueToday: number;
  proposalsToday: number;
  proposalsExpired: number;
  bigDeals: number;
  waMsgs: number;
  inactives: number;
};

function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function tomorrowISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export function useDailySignals() {
  const { orgId } = useCurrentOrg();

  return useQuery({
    queryKey: ["daily-signals", orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<DailySignals> => {
      const today = todayISO();
      const tomorrow = tomorrowISO();

      const [
        overdue,
        dueToday,
        proposalsToday,
        proposalsExpired,
        bigDeals,
        waMsgs,
        inactives,
      ] = await Promise.all([
        supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("completed", false)
          .lt("due_date", today),
        supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("completed", false)
          .gte("due_date", today)
          .lt("due_date", tomorrow),
        supabase
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .gte("valid_until", today)
          .lt("valid_until", tomorrow)
          .not("status", "in", "(accepted,rejected)"),
        supabase
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .lt("valid_until", today)
          .not("status", "in", "(accepted,rejected)"),
        supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .gte("value", 100000)
          .not("stage", "in", "(won,lost)"),
        supabase
          .from("whatsapp_conversations")
          .select("unread_count")
          .eq("status", "open")
          .gt("unread_count", 0),
        supabase
          .from("erp_customer_metrics")
          .select("id", { count: "exact", head: true })
          .gte("recency_days", 60),
      ]);

      const waCount = (waMsgs.data ?? []).reduce(
        (s, r: { unread_count: number | null }) => s + Number(r.unread_count || 0),
        0,
      );

      return {
        overdue: overdue.count ?? 0,
        dueToday: dueToday.count ?? 0,
        proposalsToday: proposalsToday.count ?? 0,
        proposalsExpired: proposalsExpired.count ?? 0,
        bigDeals: bigDeals.count ?? 0,
        waMsgs: waCount,
        inactives: inactives.count ?? 0,
      };
    },
  });
}

/** Regras de priorização (peso × contagem). Mais alto = mais urgente. */
export type PriorityItem = {
  key: keyof DailySignals;
  label: string;
  action: string;
  href: string;
  count: number;
  score: number;
  tone: "rose" | "amber" | "emerald" | "blue" | "violet" | "orange";
};

const RULES: Array<Omit<PriorityItem, "count" | "score"> & { weight: number }> = [
  { key: "waMsgs",           weight: 3.0, label: "mensagens WhatsApp esperando resposta",   action: "Responder agora",              href: "/whatsapp",                tone: "emerald" },
  { key: "proposalsToday",   weight: 5.0, label: "propostas vencem hoje",                    action: "Ligar antes do fim do dia",   href: "/proposals?filter=due-today",  tone: "amber" },
  { key: "bigDeals",         weight: 4.0, label: "oportunidades acima de R$ 100k abertas",   action: "Priorizar contato hoje",       href: "/pipeline?filter=high-value",  tone: "violet" },
  { key: "overdue",          weight: 2.5, label: "follow-ups atrasados",                     action: "Recuperar contato",            href: "/activities?filter=overdue",   tone: "rose" },
  { key: "proposalsExpired", weight: 2.0, label: "propostas expiraram sem resposta",         action: "Reengajar ou marcar perdida",  href: "/proposals?filter=expired",    tone: "orange" },
  { key: "inactives",        weight: 1.2, label: "clientes inativos há +60 dias",            action: "Campanha de reativação",       href: "/retention",                   tone: "rose" },
  { key: "dueToday",         weight: 1.0, label: "atividades agendadas para hoje",           action: "Executar sua agenda",          href: "/activities?filter=today",     tone: "blue" },
];

export function buildPriorities(signals: DailySignals | undefined, limit = 3): PriorityItem[] {
  if (!signals) return [];
  return RULES.map((r) => {
    const count = signals[r.key] ?? 0;
    return {
      key: r.key,
      label: r.label,
      action: r.action,
      href: r.href,
      tone: r.tone,
      count,
      score: count * r.weight,
    };
  })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
