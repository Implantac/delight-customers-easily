import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bookmark, Trash2, Users as UsersIcon, Building2, Briefcase, CheckSquare, Globe, Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import { listViews, deleteView, updateView } from "@/lib/views.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/views")({
  component: ViewsPage,
});

const ENTITY_META = {
  contacts: { label: "Contatos", icon: UsersIcon },
  companies: { label: "Empresas", icon: Building2 },
  deals: { label: "Negócios", icon: Briefcase },
  activities: { label: "Atividades", icon: CheckSquare },
} as const;

function ViewsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const list = useServerFn(listViews);
  const del = useServerFn(deleteView);
  const update = useServerFn(updateView);
  const [tab, setTab] = useState<"all" | keyof typeof ENTITY_META>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["saved-views", orgId],
    queryFn: () => list({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["saved-views", orgId] });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id, organization_id: orgId! } }),
    onSuccess: () => {
      toast.success("Visualização removida");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const toggleShareMut = useMutation({
    mutationFn: (p: { id: string; is_shared: boolean }) =>
      update({ data: { id: p.id, organization_id: orgId!, is_shared: p.is_shared } }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const views = (data?.views ?? []).filter((v) => tab === "all" || v.entity === tab);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visualizações salvas</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie filtros salvos e compartilhe com sua equipe.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          {(Object.keys(ENTITY_META) as Array<keyof typeof ENTITY_META>).map((k) => (
            <TabsTrigger key={k} value={k}>
              {ENTITY_META[k].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" /> {views.length} visualizações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : views.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma visualização salva. Crie uma diretamente nas páginas de Contatos, Empresas, Negócios ou Atividades.
            </p>
          ) : (
            <div className="divide-y">
              {views.map((v) => {
                const meta = ENTITY_META[v.entity as keyof typeof ENTITY_META];
                const Icon = meta?.icon ?? Bookmark;
                const filterCount = Object.keys(v.filters as Record<string, unknown>).length;
                return (
                  <div key={v.id} className="flex items-center gap-4 py-3">
                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{v.name}</span>
                        <Badge variant="outline">{meta?.label ?? v.entity}</Badge>
                        {v.is_shared ? (
                          <Badge variant="secondary" className="gap-1">
                            <Globe className="h-3 w-3" /> Compartilhada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Lock className="h-3 w-3" /> Privada
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {filterCount} filtro{filterCount === 1 ? "" : "s"} · atualizada{" "}
                        {formatDistanceToNow(new Date(v.updated_at), { addSuffix: true, locale: ptBR })}
                      </div>
                    </div>
                    {v.mine && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`share-${v.id}`} className="text-xs text-muted-foreground">
                          Compartilhar
                        </Label>
                        <Switch
                          id={`share-${v.id}`}
                          checked={v.is_shared}
                          onCheckedChange={(c) =>
                            toggleShareMut.mutate({ id: v.id, is_shared: c })
                          }
                        />
                      </div>
                    )}
                    {v.mine && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Excluir "${v.name}"?`)) delMut.mutate(v.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
