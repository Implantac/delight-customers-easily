import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Tone = "primary" | "info" | "success" | "violet" | "accent" | "rose";

const TONE_BAR: Record<Tone, string> = {
  primary: "bg-primary",
  info:    "bg-blue-500",
  success: "bg-emerald-500",
  violet:  "bg-violet-500",
  accent:  "bg-amber-500",
  rose:    "bg-rose-500",
};

const TONE_ICON: Record<Tone, string> = {
  primary: "text-primary",
  info:    "text-blue-500",
  success: "text-emerald-500",
  violet:  "text-violet-500",
  accent:  "text-amber-500",
  rose:    "text-rose-500",
};

export function PageHeader({
  title,
  subtitle,
  action,
  icon: Icon,
  tone = "accent",
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 border-b border-border/40 pb-6 mb-8 pl-4",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1 bottom-6 w-[4px] rounded-full",
          TONE_BAR[tone],
        )}
      />
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card shadow-[var(--shadow-xs)] sm:flex">
            <Icon className={cn("h-[18px] w-[18px]", TONE_ICON[tone])} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[1.25rem] sm:text-[1.5rem] md:text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.025em] text-foreground break-words">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-[13px] sm:text-sm leading-relaxed text-muted-foreground break-words">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end [&>*]:min-w-0">
          {action}
        </div>
      )}
    </motion.div>
  );
}
