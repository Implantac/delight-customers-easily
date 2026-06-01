import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "info" | "success" | "violet" | "accent" | "rose";

const TONE_BAR: Record<Tone, string> = {
  primary: "bg-[var(--gradient-primary)]",
  info:    "bg-gradient-to-b from-[#4a7ec0] to-[#7aa9d9]",
  success: "bg-gradient-to-b from-[#4a9d6a] to-[#7cc095]",
  violet:  "bg-gradient-to-b from-[#8a7cc0] to-[#a89bd6]",
  accent:  "bg-[var(--gradient-accent)]",
  rose:    "bg-gradient-to-b from-[#c46a8a] to-[#d49aae]",
};

const TONE_ICON: Record<Tone, string> = {
  primary: "text-[color:var(--primary-glow)]",
  info:    "text-[#4a7ec0]",
  success: "text-[#4a9d6a]",
  violet:  "text-[#8a7cc0]",
  accent:  "text-[color:var(--accent)]",
  rose:    "text-[#c46a8a]",
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
    <div
      className={cn(
        "relative flex items-start justify-between gap-4 border-b border-border/60 pb-5 mb-6 pl-4",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1 bottom-5 w-[3px] rounded-full",
          TONE_BAR[tone],
        )}
      />
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card shadow-[var(--shadow-xs)] sm:flex">
            <Icon className={cn("h-[18px] w-[18px]", TONE_ICON[tone])} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[1.5rem] md:text-[1.75rem] font-semibold leading-[1.1] tracking-[-0.025em] text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
