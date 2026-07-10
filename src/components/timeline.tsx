import { CheckSquare, Phone, Mail, Users, FileText, KanbanSquare, MessageCircle, Receipt, Trophy, XCircle, FormInput, CalendarPlus } from "lucide-react";

export type TimelineItem = {
  id: string;
  kind: "activity" | "deal" | "whatsapp" | "invoice" | "won" | "lost" | "email" | "form";
  type?: string | null;
  title: string;
  date: string;
  meta?: string | null;
  completed?: boolean;
};

const ACTIVITY_ICONS: Record<string, typeof CheckSquare> = {
  task: CheckSquare, call: Phone, email: Mail, meeting: Users, note: FileText,
};

const KIND_ICONS: Partial<Record<TimelineItem["kind"], typeof CheckSquare>> = {
  deal: KanbanSquare,
  whatsapp: MessageCircle,
  invoice: Receipt,
  won: Trophy,
  lost: XCircle,
  email: Mail,
  form: FormInput,
};

/**
 * Channel-aware color tokens. Each canal ganha tom próprio para varredura
 * visual rápida da timeline omnichannel (Customer 360 premium).
 */
const KIND_TONE: Record<TimelineItem["kind"], { dot: string; ring: string; chip: string; label: string }> = {
  whatsapp: {
    dot: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    label: "WhatsApp",
  },
  email: {
    dot: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/30",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    label: "E-mail",
  },
  won: {
    dot: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/40",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    label: "Ganho",
  },
  lost: {
    dot: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/30",
    chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
    label: "Perda",
  },
  invoice: {
    dot: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/30",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    label: "Fatura",
  },
  deal: {
    dot: "bg-primary/15 text-primary",
    ring: "ring-primary/30",
    chip: "bg-primary/10 text-primary",
    label: "Negócio",
  },
  activity: {
    dot: "bg-muted text-muted-foreground",
    ring: "ring-border",
    chip: "bg-muted text-muted-foreground",
    label: "Atividade",
  },
  form: {
    dot: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/30",
    chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    label: "Formulário",
  },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 36e5);
  if (diffH < 1) return "agora";
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d atrás`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

export function Timeline({ items, emptyLabel = "Nada por aqui." }: { items: TimelineItem[]; emptyLabel?: string }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <ol className="relative space-y-3 before:absolute before:left-[11px] before:top-1 before:bottom-1 before:w-px before:bg-border/60">
      {items.map((item) => {
        const Icon =
          KIND_ICONS[item.kind] ??
          (item.kind === "activity" ? ACTIVITY_ICONS[item.type ?? "task"] ?? CheckSquare : CheckSquare);
        const tone = KIND_TONE[item.kind];
        return (
          <li key={`${item.kind}-${item.id}`} className="relative pl-9">
            <span
              className={`absolute left-0 top-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full ring-2 ring-background ${tone.dot}`}
              aria-hidden
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="group rounded-md border border-border/50 bg-card/40 px-3 py-2 transition-colors hover:border-border hover:bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone.chip}`}>
                      {tone.label}
                    </span>
                    {item.meta && (
                      <span className="truncate text-[11px] text-muted-foreground tabular-nums">
                        {item.meta}
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-1 text-sm leading-snug ${
                      item.completed ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {item.title}
                  </p>
                </div>
                <time className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {formatDate(item.date)}
                </time>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
