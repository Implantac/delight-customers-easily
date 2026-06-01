import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { getErpHealth } from "@/lib/erp-hub.functions";
import { listErpSyncJobs, getErpHealthOverview } from "@/lib/connect-hub.functions";
import { listErpSchedules, FREQ_LABELS } from "@/lib/erp-schedule.functions";
import { FRIENDLY_ERPS } from "@/lib/connect-hub";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Zap,
  Plug,
  Calendar,
  RefreshCw,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/_app/integrations/dashboard")({
  component: ExecutiveDashboard,
});

function ExecutiveDashboard() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const fetchHealth = useServerFn(getErpHealth);
  const fetchJobs = useServerFn(listErpSyncJobs);
  const fetchOverview = useServerFn(getErpHealthOverview);
  const fetchSchedules = useServerFn(listErpSchedules);

  const health = useQuery({
    queryKey: ["dash-health", orgId],
    queryFn: () => fetchHealth({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 30_000,
  });
  const jobs = useQuery({
    queryKey: ["dash-jobs", orgId],
    queryFn: () => fetchJobs({ data: { organizationId: orgId!, limit: 200 } }),
    enabled: !!orgId,
    refetchInterval: 30_000,
  });
  const overview = useQuery({
    queryKey: ["dash-overview", orgId],
    queryFn: () => fetchOverview({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 30_000,
  });
  const schedules = useQuery({
    queryKey: ["dash-schedules", orgId],
    queryFn: () => fetchSchedules({ data: { organizationId: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  const stats = useMemo(() => {
    const rows = health.data?.rows ?? [];
    const configured = rows.filter((r) => r.is_configured);
    const all = jobs.data?.rows ?? [];
    const last24h = all.filter((j) => {
      const t = new Date(j.scheduled_at).getTime();
      return Date.now() - t < 24 * 60 * 60_000;
    });
    const succeeded24h = last24h.filter((j) => j.status === "succeeded").length;
    const failed24h = last24h.filter((j) => j.status === "failed").length;
    const total24h = last24h.length;
    const sla =
      total24h > 0 ? Math.round((succeeded24h / total24h) * 100) : null;

    const avgLatency = (() => {
      const vals = configured
        .map((r) => r.latency_ms)
        .filter((v): v is number => typeof v === "number");
      if (vals.length === 0) return null;
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    })();

    const totalRecords = configured.reduce(
      (acc, r) => acc + (r.contacts_synced ?? 0) + (r.companies_synced ?? 0),
      0,
    );

    return {
      total: configured.length,
      online: configured.filter((r) => r.status === "online").length,
      degraded: configured.filter((r) => r.status === "degraded").length,
      offline: configured.filter((r) => r.status === "offline").length,
      sla,
      succeeded24h,
      failed24h,
      total24h,
      avgLatency,
      totalRecords,
      openConflicts: overview.data?.totalOpenConflicts ?? 0,
      openJobs: overview.data?.totalOpenJobs ?? 0,
    };
  }, [health.data, jobs.data, overview.data]);

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Sem acesso ao dashboard executivo do ConnectHub.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        icon={BarChart3}
        title="Dashboard executivo"
        subtitle="Visão consolidada de saúde, SLA e volume de sincronização."
        action={
          <Link to="/integrations">
            <Button variant="ghost" size="sm">
              ← Voltar ao ConnectHub
            </Button>
          </Link>
        }
      />

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Plug}
          label="ERPs ativos"
          value={`${stats.online}/${stats.total}`}
          hint={`${stats.degraded} atenção · ${stats.offline} offline`}
          tone="primary"
        />
        <KpiCard
          icon={TrendingUp}
          label="SLA últimas 24h"
          value={stats.sla != null ? `${stats.sla}%` : "—"}
          hint={`${stats.succeeded24h} ok · ${stats.failed24h} falhas`}
          tone={
            stats.sla == null
              ? "muted"
              : stats.sla >= 95
                ? "green"
                : stats.sla >= 80
                  ? "amber"
                  : "red"
          }
        />
        <KpiCard
          icon={Zap}
          label="Latência média"
          value={stats.avgLatency != null ? `${stats.avgLatency} ms` : "—"}
          hint="Resposta dos ERPs conectados"
          tone={
            stats.avgLatency == null
              ? "muted"
              : stats.avgLatency < 800
                ? "green"
                : stats.avgLatency < 2500
                  ? "amber"
                  : "red"
          }
        />
        <KpiCard
          icon={AlertTriangle}
          label="Conflitos abertos"
          value={stats.openConflicts}
          hint={`${stats.openJobs} jobs em andamento`}
          tone={stats.openConflicts > 0 ? "amber" : "muted"}
        />
      </div>

      {/* Volume + SLA breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> SLA por integração (24h)
            </CardTitle>
            <CardDescription>
              Taxa de sucesso de jobs por conector.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const all = jobs.data?.rows ?? [];
              const last24 = all.filter(
                (j) => Date.now() - new Date(j.scheduled_at).getTime() < 86_400_000,
              );
              const byInteg = new Map<
                string,
                { ok: number; fail: number; total: number }
              >();
              for (const j of last24) {
                const cur = byInteg.get(j.integration_id) ?? {
                  ok: 0,
                  fail: 0,
                  total: 0,
                };
                cur.total++;
                if (j.status === "succeeded") cur.ok++;
                else if (j.status === "failed") cur.fail++;
                byInteg.set(j.integration_id, cur);
              }
              const rows = health.data?.rows ?? [];
              const items = Array.from(byInteg.entries())
                .map(([id, v]) => {
                  const r = rows.find((rr) => rr.integration_id === id);
                  const friendly = FRIENDLY_ERPS.find(
                    (f) => f.id === r?.provider,
                  );
                  const pct = v.total > 0 ? Math.round((v.ok / v.total) * 100) : 0;
                  return {
                    id,
                    name: friendly?.name ?? r?.provider ?? "ERP",
                    logo: friendly?.logo ?? "🔌",
                    pct,
                    ok: v.ok,
                    fail: v.fail,
                    total: v.total,
                  };
                })
                .sort((a, b) => b.total - a.total);
              if (items.length === 0)
                return (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Sem jobs nas últimas 24h.
                  </p>
                );
              return items.map((it) => (
                <div key={it.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <span>{it.logo}</span>
                      <span className="font-medium truncate">{it.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {it.ok}/{it.total} ok
                    </span>
                  </div>
                  <Progress value={it.pct} className="h-2" />
                </div>
              ));
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Agendamentos ativos
            </CardTitle>
            <CardDescription>
              Próximas execuções automáticas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(() => {
              const items = (schedules.data?.rows ?? []).filter(
                (r) => r.frequency !== "off" && r.is_active,
              );
              if (items.length === 0)
                return (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Nenhum sync agendado.
                    </p>
                    <Link to="/integrations">
                      <Button size="sm" variant="outline" className="gap-2">
                        <Calendar className="h-3 w-3" /> Configurar agendamento
                      </Button>
                    </Link>
                  </div>
                );
              return items.map((r) => {
                const friendly = FRIENDLY_ERPS.find((f) => f.id === r.provider);
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{friendly?.logo ?? "🔌"}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {friendly?.name ?? r.provider}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {FREQ_LABELS[r.frequency]} ·{" "}
                          {r.resources?.length ?? 0} recursos
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {r.next_sync_at
                          ? new Date(r.next_sync_at).toLocaleTimeString(
                              "pt-BR",
                              { hour: "2-digit", minute: "2-digit" },
                            )
                          : "—"}
                      </Badge>
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Volume total */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Volume sincronizado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <div className="text-3xl font-semibold">
                {stats.totalRecords.toLocaleString("pt-BR")}
              </div>
              <div className="text-xs text-muted-foreground">
                Registros importados no total
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-semibold">{stats.total24h}</div>
              <div className="text-xs text-muted-foreground">
                Jobs executados (24h)
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-semibold flex items-center gap-2">
                {stats.openJobs}
                {stats.openJobs > 0 && (
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Em execução agora
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  tone: "primary" | "green" | "amber" | "red" | "muted";
}) {
  const color =
    tone === "green"
      ? "text-emerald-600 bg-emerald-500/10"
      : tone === "amber"
        ? "text-amber-600 bg-amber-500/10"
        : tone === "red"
          ? "text-red-600 bg-red-500/10"
          : tone === "primary"
            ? "text-primary bg-primary/10"
            : "text-muted-foreground bg-muted";
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-3">
          <div
            className={`h-9 w-9 rounded-md flex items-center justify-center ${color}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        </div>
        <div className="text-2xl font-semibold leading-none">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
