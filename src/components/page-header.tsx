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
    <div className={cn("flex items-start justify-between gap-4 pb-1", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-card text-primary shadow-[var(--shadow-xs)] sm:flex">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="bg-[var(--gradient-primary)] bg-clip-text text-2xl font-semibold tracking-tight text-transparent md:text-[1.75rem]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
