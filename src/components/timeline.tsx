import { CheckSquare, Phone, Mail, Users, FileText, KanbanSquare } from "lucide-react";

export type TimelineItem = {
  id: string;
  kind: "activity" | "deal";
  type?: string | null;
  title: string;
  date: string;
  meta?: string | null;
  completed?: boolean;
};

const ACTIVITY_ICONS: Record<string, typeof CheckSquare> = {
  task: CheckSquare, call: Phone, email: Mail, meeting: Users, note: FileText,
};

export function Timeline({ items, emptyLabel = "Nada por aqui." }: { items: TimelineItem[]; emptyLabel?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {items.map((item) => {
        const Icon = item.kind === "deal" ? KanbanSquare : (ACTIVITY_ICONS[item.type ?? "task"] ?? CheckSquare);
        return (
          <li key={`${item.kind}-${item.id}`} className="relative">
            <span className="absolute -left-[26px] flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground">
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-sm font-medium ${item.completed ? "text-muted-foreground line-through" : ""}`}>
                  {item.title}
                </p>
                {item.meta && <p className="text-xs text-muted-foreground">{item.meta}</p>}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">
                {new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
