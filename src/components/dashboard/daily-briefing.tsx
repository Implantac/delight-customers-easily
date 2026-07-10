import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, MessageSquare, FileClock, DollarSign, Clock, UserX, AlertTriangle, CalendarDays } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useDailySignals, buildPriorities, type PriorityItem } from "@/lib/daily-signals";

/**
 * Copiloto de Vendas — Briefing Diário.
 * Abre com "Bom dia, <nome>. Hoje identifiquei…" e propõe Prioridade 1/2/3.
 * Modo: apenas SUGERIR (nenhuma execução automática).
 */

const iconFor: Record<PriorityItem["key"], typeof MessageSquare> = {
  waMsgs: MessageSquare,
  proposalsToday: FileClock,
  proposalsExpired: AlertTriangle,
  bigDeals: DollarSign,
  overdue: Clock,
  inactives: UserX,
  dueToday: CalendarDays,
};

const toneMap: Record<PriorityItem["tone"], { chip: string; ring: string; text: string; bar: string; grad: string }> = {
  rose:    { chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400",       ring: "ring-rose-500/30",    text: "text-rose-600 dark:text-rose-400",       bar: "bg-rose-500",    grad: "from-rose-500/10" },
  amber:   { chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",    ring: "ring-amber-500/30",   text: "text-amber-600 dark:text-amber-400",    bar: "bg-amber-500",   grad: "from-amber-500/10" },
  emerald: { chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/30", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", grad: "from-emerald-500/10" },
  blue:    { chip: "bg-blue-500/10 text-blue-600 dark:text-blue-400",       ring: "ring-blue-500/30",    text: "text-blue-600 dark:text-blue-400",       bar: "bg-blue-500",    grad: "from-blue-500/10" },
  violet:  { chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400", ring: "ring-violet-500/30",  text: "text-violet-600 dark:text-violet-400",   bar: "bg-violet-500",  grad: "from-violet-500/10" },
  orange:  { chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400", ring: "ring-orange-500/30",  text: "text-orange-600 dark:text-orange-400",   bar: "bg-orange-500",  grad: "from-orange-500/10" },
};

function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function narrate(items: PriorityItem[]): string[] {
  return items.map((p) => `${p.count} ${p.label}`);
}

export function DailyBriefing() {
  const { user } = useAuth();
  const q = useDailySignals();
  const loading = q.isLoading;
  const priorities = buildPriorities(q.data, 3);
  const observations = narrate(priorities);

  const firstName =
    (user?.user_metadata?.full_name ?? user?.email ?? "").split(" ")[0] || "vendedor(a)";

  return (
    <section className="relative z-10">
      <Card className="relative overflow-hidden rounded-[2rem] border-border/50 bg-card/60 backdrop-blur-2xl p-6 md:p-8">
        {/* Glow decor */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-4 min-w-0">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-sm">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/70 mb-1">
                Copiloto de Vendas · Briefing
              </div>
              <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight leading-tight">
                {greetingFor()}, <span className="text-primary italic">{firstName}</span>. Hoje identifiquei:
              </h2>
            </div>
          </div>
          <Badge variant="outline" className="h-fit py-2 px-3 bg-emerald-500/5 text-emerald-600 border-emerald-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl">
            Modo sugerir
          </Badge>
        </div>

        {/* Observações narradas */}
        <div className="relative mt-6 pl-16 space-y-1.5 text-sm text-foreground/85 leading-relaxed">
          {loading ? (
            <>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </>
          ) : observations.length === 0 ? (
            <p className="text-muted-foreground">
              Nenhum sinal urgente agora. Aproveite para prospectar ou revisar sua carteira.
            </p>
          ) : (
            observations.map((line, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <span className="text-primary">•</span>
                <span>{line}.</span>
              </div>
            ))
          )}
        </div>

        {/* Prioridades sugeridas */}
        {!loading && priorities.length > 0 && (
          <div className="relative mt-8 space-y-3">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/70 pl-1">
              Minha sugestão para você agora
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {priorities.map((p, i) => (
                <PriorityCard key={p.key} item={p} rank={i + 1} />
              ))}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

function PriorityCard({ item, rank }: { item: PriorityItem; rank: number }) {
  const tone = toneMap[item.tone];
  const Icon = iconFor[item.key];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={item.href as any} className="group block h-full">
        <div
          className={`relative h-full overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br ${tone.grad} to-transparent p-4 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-lg hover:ring-1 hover:${tone.ring}`}
        >
          <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r ${tone.bar}`} />
          <div className="pl-2 flex items-start gap-3">
            <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center font-display font-bold text-sm ${tone.chip}`}>
              {rank}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-3.5 w-3.5 ${tone.text}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                  Prioridade {rank}
                </span>
              </div>
              <div className="text-sm font-semibold text-foreground leading-snug">
                {item.action}
              </div>
              <div className="text-xs text-muted-foreground mt-1 leading-snug">
                <span className={`font-bold tabular-nums ${tone.text}`}>{item.count}</span>{" "}
                {item.label}
              </div>
              <div className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold ${tone.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
                Ir agora <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
