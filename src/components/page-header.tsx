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
        "flex items-start justify-between gap-4 border-b border-border/40 pb-4 mb-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br from-card to-accent/30 text-primary shadow-[var(--shadow-sm)] sm:flex">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="bg-[var(--gradient-primary)] bg-clip-text text-2xl font-semibold tracking-tight text-transparent md:text-[1.75rem] leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
