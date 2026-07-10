import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Tone = "primary" | "info" | "success" | "violet" | "accent" | "rose";

const TONE_ICON: Record<Tone, string> = {
  primary: "text-primary",
  info:    "text-blue-500",
  success: "text-emerald-500",
  violet:  "text-violet-500",
  accent:  "text-amber-500",
  rose:    "text-rose-500",
};

/**
 * Padrão de página: Header (título + ações) → Filtros/Tabs opcionais → Conteúdo.
 * Densidade compacta (Linear/Attio). Sticky quando o slot `filters` é usado.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  filters,
  icon: Icon,
  tone = "accent",
  className,
  compact = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  filters?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "sticky top-11 z-20 mb-4 border-b border-border/40 bg-background/85 backdrop-blur-xl",
        className,
      )}
    >
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3",
          compact ? "py-2.5" : "py-4",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <div className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card sm:flex">
              <Icon className={cn("h-[14px] w-[14px]", TONE_ICON[tone])} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[15px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[16px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 truncate text-[11.5px] leading-snug text-muted-foreground sm:text-xs">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && (
          <div className="flex flex-wrap items-center gap-1.5 justify-end [&>*]:min-w-0">
            {action}
          </div>
        )}
      </motion.div>
      {filters && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/30 py-2 text-[12.5px]">
          {filters}
        </div>
      )}
    </div>
  );
}

