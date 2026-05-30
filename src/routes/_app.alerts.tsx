import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { listAlerts, generateAlertNotifications } from "@/lib/alerts.functions";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Bell, Clock, Flame, Snowflake, UserX, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/alerts")({ component: AlertsPage });

const KIND_META: Record<string, { icon: any; label: string }> = {
  stale_deal:       { icon: Clock,       label: "Negócio parado" },
  high_value_idle:  { icon: Flame,       label: "Alto valor sem ação" },
  closing_soon:     { icon: AlertTriangle, label: "Fechamento próximo" },
  silent_contact:   { icon: UserX,       label: "Cliente silencioso" },
  overdue_task:     { icon: Snowflake,   label: "Tarefa atrasada" },
};

const SEV_STYLES: Record<string, string> = {
  high:   "border-l-rose-500 bg-rose-500/5",
  medium: "border-l-amber-500 bg-amber-500/5",
  low:    "border-l-sky-500 bg-sky-500/5",
};

function AlertsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listAlerts);
  const generateFn = useServerFn(generateAlertNotifications);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["alerts", orgId],
    enabled: !!orgId,
    queryFn: () => listFn({ data: { organization_id: orgId! } }),
  });

  const generate = useMutation({
    mutationFn: () => generateFn({ data: { organization_id: orgId! } }),
    onSuccess: (res) => {
      toast.success(`${res.generated} notificação(ões) enviada(s)`);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const counts = data?.counts ?? { high: 0, medium: 0, low: 0, total: 0 };
  const alerts = data?.alerts ?? [];
  const grouped = alerts.reduce<Record<string, typeof alerts>>((acc, a) => {
    (acc[a.kind] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Central de Alertas"
        subtitle="Sinais que exigem ação agora — negócios parados, clientes silenciosos, tarefas atrasadas."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending || !alerts.length}>
              <Bell className="mr-2 h-4 w-4" />
              Notificar equipe
            </Button>
          </div>
        }
      />

      <div className="mt-6">
        <NextActionBlock surface="alerts" title="Ações priorizadas pela IA" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total de alertas" value={counts.total} tone="default" />
        <KpiCard label="Críticos" value={counts.high} tone="rose" />
        <KpiCard label="Atenção" value={counts.medium} tone="amber" />
        <KpiCard label="Informativos" value={counts.low} tone="sky" />
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : alerts.length === 0 ? (
        <Card className="mt-6 p-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-lg font-medium">Tudo sob controle</p>
          <p className="mt-1 text-sm text-muted-foreground">Nenhum sinal de risco no momento.</p>
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          {Object.entries(grouped).map(([kind, items]) => {
            const meta = KIND_META[kind] ?? { icon: AlertTriangle, label: kind };
            const Icon = meta.icon;
            return (
              <section key={kind}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{meta.label}</h3>
                  <Badge variant="secondary" className="ml-1">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.slice(0, 15).map((a, idx) => (
                    <Card
                      key={`${a.entity_id}-${idx}`}
                      className={`flex items-center justify-between border-l-4 p-3 ${SEV_STYLES[a.severity]}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.body}</p>
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={a.link as any}>
                          Abrir <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </Card>
                  ))}
                  {items.length > 15 && (
                    <p className="text-xs text-muted-foreground">+ {items.length - 15} ocultos</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: "default" | "rose" | "amber" | "sky" }) {
  const colors: Record<string, string> = {
    default: "text-foreground",
    rose: "text-rose-500",
    amber: "text-amber-500",
    sky: "text-sky-500",
  };
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colors[tone]}`}>{value}</p>
    </Card>
  );
}
