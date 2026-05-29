import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, History as HistoryIcon } from "lucide-react";

interface Props {
  entityType: "contacts" | "companies" | "activities" | "deals";
  entityId: string;
}

const ACTION_META: Record<string, { icon: typeof Plus; label: string; className: string }> = {
  created: { icon: Plus, label: "criou", className: "text-success" },
  updated: { icon: Pencil, label: "atualizou", className: "text-primary" },
  deleted: { icon: Trash2, label: "removeu", className: "text-destructive" },
};

function fmtRelative(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatChanges(changes: unknown): string[] {
  if (!changes || typeof changes !== "object") return [];
  return Object.entries(changes as Record<string, { from: unknown; to: unknown }>)
    .filter(([k]) => !["id", "user_id", "organization_id"].includes(k))
    .slice(0, 5)
    .map(([k, v]) => {
      const from = v?.from == null || v.from === "" ? "—" : String(v.from);
      const to = v?.to == null || v.to === "" ? "—" : String(v.to);
      return `${k}: ${from.slice(0, 40)} → ${to.slice(0, 40)}`;
    });
}

export function AuditHistory({ entityType, entityId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["audit_log", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, action, changes, created_at, user_id")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-32" />;

  if (!data || data.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        <HistoryIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
        Nenhuma alteração registrada ainda.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((event) => {
        const meta = ACTION_META[event.action] ?? ACTION_META.updated;
        const Icon = meta.icon;
        const changes = event.action === "updated" ? formatChanges(event.changes) : [];
        return (
          <Card key={event.id} className="p-3 flex gap-3">
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.className}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm">
                  <span className="font-medium">Alguém</span>{" "}
                  <span className="text-muted-foreground">{meta.label} este registro</span>
                </p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {fmtRelative(event.created_at)}
                </span>
              </div>
              {changes.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {changes.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground font-mono truncate">
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
