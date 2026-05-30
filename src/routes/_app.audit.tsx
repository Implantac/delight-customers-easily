import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight, History, Search } from "lucide-react";
import { getAuditLog } from "@/lib/audit.functions";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/audit")({ component: AuditPage });

const ACTION_TONE: Record<string, string> = {
  create: "bg-emerald-500/15 text-emerald-600",
  insert: "bg-emerald-500/15 text-emerald-600",
  update: "bg-blue-500/15 text-blue-600",
  delete: "bg-red-500/15 text-red-600",
};

function AuditPage() {
  const { orgId } = useCurrentOrg();
  const [entity, setEntity] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const call = useServerFn(getAuditLog);
  const { data, isLoading } = useQuery({
    queryKey: ["audit", orgId, entity, action],
    enabled: !!orgId,
    queryFn: () => call({
      data: {
        organization_id: orgId!,
        entity_type: entity === "all" ? undefined : entity,
        action: action === "all" ? undefined : action,
      },
    }),
    refetchOnWindowFocus: false,
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data?.items ?? [];
    return (data?.items ?? []).filter((i) =>
      i.entity_type.includes(s) || i.action.includes(s) ||
      i.entity_id.includes(s) || (i.user_name?.toLowerCase().includes(s) ?? false)
    );
  }, [data, search]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Auditoria"
        subtitle="Histórico completo de alterações por usuário, entidade e ação."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-7" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Entidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas entidades</SelectItem>
            {(data?.facets.entities ?? []).map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ações</SelectItem>
            {(data?.facets.actions ?? []).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <History className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum evento de auditoria.</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y">
            {filtered.map((e) => {
              const open = openId === e.id;
              const initials = (e.user_name ?? "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
              return (
                <li key={e.id}>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                    onClick={() => setOpenId(open ? null : e.id)}
                  >
                    {open ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.user_name ?? "Sistema"}</span>
                        <Badge className={ACTION_TONE[e.action] ?? "bg-muted text-muted-foreground"}>{e.action}</Badge>
                        <span className="text-sm text-muted-foreground">{e.entity_type}</span>
                        <span className="truncate font-mono text-xs text-muted-foreground">{e.entity_id.slice(0, 8)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </button>
                  {open && e.changes && (
                    <div className="border-t bg-muted/30 px-4 py-3">
                      <pre className="overflow-x-auto text-xs">{JSON.stringify(e.changes, null, 2)}</pre>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="border-t p-3 text-center text-xs text-muted-foreground">
            {filtered.length} evento{filtered.length !== 1 ? "s" : ""}
          </div>
        </Card>
      )}
    </div>
  );
}
