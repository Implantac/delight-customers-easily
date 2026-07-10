import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  MessageSquare,
  FileClock,
  AlertTriangle,
  DollarSign,
  Clock,
  UserX,
  CalendarDays,
  Sparkles,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org";

/**
 * "O que preciso fazer hoje?" — painel de sinais acionáveis no topo do Dashboard.
 * Cada tile é uma pergunta objetiva com contagem viva + link filtrado.
 * Sem execução automática: apenas SUGERE (o vendedor decide).
 */

type Tone = "rose" | "amber" | "emerald" | "blue" | "violet" | "orange";

type Tile = {
  key: string;
  count: number;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  href: string;
  loading?: boolean;
};

const toneMap: Record<Tone, { chip: string; ring: string; text: string; bar: string }> = {
  rose:    { chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400",       ring: "ring-rose-500/20",    text: "text-rose-600 dark:text-rose-400",       bar: "bg-rose-500" },
  amber:   { chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",    ring: "ring-amber-500/20",   text: "text-amber-600 dark:text-amber-400",    bar: "bg-amber-500" },
  emerald: { chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  blue:    { chip: "bg-blue-500/10 text-blue-600 dark:text-blue-400",       ring: "ring-blue-500/20",    text: "text-blue-600 dark:text-blue-400",       bar: "bg-blue-500" },
  violet:  { chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400", ring: "ring-violet-500/20",  text: "text-violet-600 dark:text-violet-400",   bar: "bg-violet-500" },
  orange:  { chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400", ring: "ring-orange-500/20",  text: "text-orange-600 dark:text-orange-400",   bar: "bg-orange-500" },
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

export function DoTodayPanel() {
  const { orgId } = useCurrentOrg();

  const q = useQuery({
    queryKey: ["do-today-panel", orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async () => {
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
        // Follow-ups atrasados
        supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("completed", false)
          .lt("due_date", today),
        // Follow-ups agendados para hoje
        supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("completed", false)
          .gte("due_date", today)
          .lt("due_date", tomorrow),
        // Propostas que vencem hoje
        supabase
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .gte("valid_until", today)
          .lt("valid_until", tomorrow)
          .not("status", "in", "(accepted,rejected)"),
        // Propostas expiradas sem resposta
        supabase
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .lt("valid_until", today)
          .not("status", "in", "(accepted,rejected)"),
        // Oportunidades quentes (>= 100k) abertas
        supabase
          .from("deals")
          .select("id", { count: "exact", head: true })
          .gte("value", 100000)
          .not("stage", "in", "(won,lost)"),
        // WhatsApp com mensagens não lidas
        supabase
          .from("whatsapp_conversations")
          .select("unread_count")
          .eq("status", "open")
          .gt("unread_count", 0),
        // Clientes inativos (ERP metrics — sem compra há 60+ dias)
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

  const d = q.data;
  const loading = q.isLoading;

  const tiles: Tile[] = [
    {
      key: "wa",
      count: d?.waMsgs ?? 0,
      label: "mensagens WhatsApp esperando resposta",
      hint: "Responder agora reduz risco de perder o lead",
      icon: MessageSquare,
      tone: "emerald",
      href: "/whatsapp",
      loading,
    },
    {
      key: "overdue",
      count: d?.overdue ?? 0,
      label: "follow-ups atrasados",
      hint: "Estavam agendados e não foram feitos",
      icon: Clock,
      tone: "rose",
      href: "/activities?filter=overdue",
      loading,
    },
    {
      key: "today",
      count: d?.dueToday ?? 0,
      label: "atividades para hoje",
      hint: "Sua agenda comercial de hoje",
      icon: CalendarDays,
      tone: "blue",
      href: "/activities?filter=today",
      loading,
    },
    {
      key: "prop-today",
      count: d?.proposalsToday ?? 0,
      label: "propostas vencem hoje",
      hint: "Última janela para fechar ou renegociar",
      icon: FileClock,
      tone: "amber",
      href: "/proposals?filter=due-today",
      loading,
    },
    {
      key: "prop-expired",
      count: d?.proposalsExpired ?? 0,
      label: "propostas expiraram sem resposta",
      hint: "Reengajar cliente ou marcar como perdida",
      icon: AlertTriangle,
      tone: "orange",
      href: "/proposals?filter=expired",
      loading,
    },
    {
      key: "big",
      count: d?.bigDeals ?? 0,
      label: "oportunidades acima de R$ 100k abertas",
      hint: "Alto impacto — priorize contato hoje",
      icon: DollarSign,
      tone: "violet",
      href: "/pipeline?filter=high-value",
      loading,
    },
    {
      key: "inactive",
      count: d?.inactives ?? 0,
      label: "clientes inativos há mais de 60 dias",
      hint: "Candidatos a reativação e recompra",
      icon: UserX,
      tone: "rose",
      href: "/retention",
      loading,
    },
  ];

  const totalSignals = tiles.reduce((s, t) => s + t.count, 0);

  return (
    <section className="relative z-10 space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-sm">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold tracking-tight">
              O que preciso fazer hoje?
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              {loading
                ? "Analisando sua operação…"
                : totalSignals === 0
                  ? "Tudo em dia por aqui. Bom trabalho."
                  : `${totalSignals} sinais acionáveis identificados agora`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((t, i) => (
          <TileCard key={t.key} tile={t} index={i} />
        ))}
      </div>
    </section>
  );
}

function TileCard({ tile, index }: { tile: Tile; index: number }) {
  const tone = toneMap[tile.tone];
  const dim = tile.count === 0;
  const Icon = tile.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={tile.href as any} className="group block h-full">
        <Card
          className={[
            "relative h-full p-5 rounded-2xl border-border/50 bg-card/60 backdrop-blur-xl",
            "transition-all duration-500 hover:-translate-y-0.5 hover:shadow-xl",
            dim ? "opacity-60 hover:opacity-90" : `hover:ring-1 hover:${tone.ring}`,
          ].join(" ")}
        >
          <span
            className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r ${tone.bar} ${dim ? "opacity-30" : "opacity-80"}`}
          />
          <div className="flex items-start justify-between gap-3 pl-2">
            <div className={`p-2 rounded-xl ${tone.chip}`}>
              <Icon className="h-4 w-4" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="mt-4 pl-2 space-y-1">
            {tile.loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className={`text-4xl font-display font-bold tabular-nums leading-none ${dim ? "text-muted-foreground" : tone.text}`}>
                {tile.count}
              </div>
            )}
            <div className="text-sm font-medium text-foreground/90 leading-snug">
              {tile.label}
            </div>
            <div className="text-[11px] text-muted-foreground/80 leading-snug pt-1">
              {tile.hint}
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
