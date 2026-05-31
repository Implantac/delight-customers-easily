import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, Check, Trash2, CheckCheck, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} from "@/lib/notifications-center.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { orgId } = useCurrentOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listNotifications);
  const markReadFn = useServerFn(markRead);
  const markAllFn = useServerFn(markAllRead);
  const delFn = useServerFn(deleteNotification);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", orgId, filter],
    queryFn: () =>
      list({
        data: { organization_id: orgId!, only_unread: filter === "unread", limit: 100 },
      }),
    enabled: !!orgId,
  });

  useEffect(() => {
    if (!orgId || !user?.id) return;
    const ch = supabase
      .channel("notifications-center")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", orgId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orgId, user?.id, qc]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notifications", orgId] });

  const readOne = useMutation({
    mutationFn: (id: string) => markReadFn({ data: { ids: [id] } }),
    onSuccess: invalidate,
  });

  const readAll = useMutation({
    mutationFn: () => markAllFn({ data: { organization_id: orgId! } }),
    onSuccess: () => {
      toast.success("Tudo marcado como lido");
      invalidate();
    },
  });

  const removeOne = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        icon={Bell}
        title="Notificações"
        subtitle="Acompanhe alertas, menções e eventos da sua conta em um único lugar."
        action={
          <Button
            variant="outline"
            disabled={!data?.unread || readAll.isPending}
            onClick={() => readAll.mutate()}
          >
            <CheckCheck className="mr-2 h-4 w-4" /> Marcar todas como lidas
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="unread">
            Não lidas
            {data?.unread ? (
              <Badge variant="destructive" className="ml-2">
                {data.unread}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> {items.length} notificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sem notificações {filter === "unread" ? "não lidas" : ""}.
            </p>
          ) : (
            <div className="divide-y">
              {items.map((n) => {
                const unread = !n.read_at;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 py-3 ${unread ? "" : "opacity-60"}`}
                  >
                    <div
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${unread ? "bg-primary" : "bg-muted-foreground/40"}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{n.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {n.type}
                        </Badge>
                      </div>
                      {n.body && (
                        <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                        {n.link && (
                          <Link
                            to={n.link as any}
                            className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                            onClick={() => unread && readOne.mutate(n.id)}
                          >
                            Ver <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                    {unread && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Marcar como lida"
                        onClick={() => readOne.mutate(n.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Excluir"
                      onClick={() => removeOne.mutate(n.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
