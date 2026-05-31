import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border/50 pb-5 mb-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-primary shadow-[var(--shadow-xs)] sm:flex">
            <Icon className="h-[18px] w-[18px]" />
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
