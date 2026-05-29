import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed bg-card/40 p-12 text-center animate-in fade-in zoom-in-95 duration-300",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[var(--gradient-subtle)]" />
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="relative font-semibold">{title}</h3>
      {description && <p className="relative mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}
