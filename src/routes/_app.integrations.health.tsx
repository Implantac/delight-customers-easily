import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import {
  listErpHealth,
  listErpConflicts,
  resolveErpConflict,
} from "@/lib/erp-health.functions";
import { enqueueErpSync } from "@/lib/connect-hub.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  Zap,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_app/integrations/health")({
  component: HealthCenterPage,
});

type Conflict = {
  id: string;
  integration_id: string;
  resource: string;
  external_id: string;
  field: string | null;
  crm_value: unknown;
  erp_value: unknown;
  detected_at: string;
};

function statusBadge(s: string) {
  const map: Record<string, string> = {
    healthy: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    degraded: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    down: "bg-destructive/15 text-destructive border-destructive/30",
    unknown: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={map[s] ?? map.unknown}>
      {s}
    </Badge>
  );
}

function HealthCenterPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const healthFn = useServerFn(listErpHealth);
  const conflictsFn = useServerFn(listErpConflicts);
  const resolveFn = useServerFn(resolveErpConflict);
  const enqueueSync = useServerFn(enqueueErpSync);

  const health = useQuery({
    queryKey: ["erp-health-list", orgId],
    queryFn: () => healthFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 30_000,
  });

  const conflicts = useQuery({
    queryKey: ["erp-conflicts", orgId],
    queryFn: () => conflictsFn({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
  });

  const [active, setActive] = useState<Conflict | null>(null);
  const [notes, setNotes] = useState("");

  const resolve = useMutation({
    mutationFn: (v: { resolution: "use_crm" | "use_erp" | "merge" | "ignore" }) =>
      resolveFn({
        data: {
          organization_id: orgId!,
          conflict_id: active!.id,
          resolution: v.resolution,
          notes: notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Conflito resolvido");
      setActive(null);
      setNotes("");
      qc.invalidateQueries({ queryKey: ["erp-conflicts", orgId] });
      qc.invalidateQueries({ queryKey: ["erp-health-list", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retryMut = useMutation({
    mutationFn: (integrationId: string) =>
      enqueueSync({
        data: {
          organizationId: orgId!,
          integrationId,
          resources: ["customers", "sales_history"],
          direction: "pull",
        },
      }),
    onSuccess: () => {
      toast.success("Nova tentativa enfileirada");
      qc.invalidateQueries({ queryKey: ["erp-health-list", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = health.data?.items ?? [];
  const summary = useMemo(() => {
    let healthy = 0,
      degraded = 0,
      down = 0,
      pending = 0,
      failed = 0,
      conflictsOpen = 0,
      stale = 0;
    const STALE_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const staleList: typeof items = [];
    for (const i of items) {
      if (i.health_status === "healthy") healthy++;
      else if (i.health_status === "degraded") degraded++;
      else if (i.health_status === "down") down++;
      pending += i.pending_jobs ?? 0;
      failed += i.failed_jobs ?? 0;
      conflictsOpen += i.open_conflicts ?? 0;
      if (i.is_active) {
        const last = i.last_sync_at ? new Date(i.last_sync_at).getTime() : 0;
        if (!last || now - last > STALE_MS) {
          stale++;
          staleList.push(i);
        }
      }
    }
    return { healthy, degraded, down, pending, failed, conflictsOpen, stale, staleList };
  }, [items]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        icon={Activity}
        title="ERP Health Center"
        subtitle="Status das integrações comerciais com o ERP e resolução de conflitos."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              health.refetch();
              conflicts.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        }
      />

      {summary.stale > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-amber-700">
                {summary.stale} integração(ões) sem sincronizar há mais de 24h
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {summary.staleList.map((i) => i.provider).join(", ")}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                summary.staleList.forEach((i) => retryMut.mutate(i.integration_id));
              }}
              disabled={retryMut.isPending}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${retryMut.isPending ? "animate-spin" : ""}`} />
              Re-sincronizar todas
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resumo */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <SummaryChip
          icon={CheckCircle2}
          label="Saudáveis"
          value={summary.healthy}
          tone="green"
        />
        <SummaryChip
          icon={AlertTriangle}
          label="Degradadas"
          value={summary.degraded}
          tone="amber"
        />
        <SummaryChip
          icon={AlertTriangle}
          label="Fora do ar"
          value={summary.down}
          tone="red"
        />
        <SummaryChip
          icon={Loader2}
          label="Pendentes"
          value={summary.pending}
          tone="muted"
          spinning={summary.pending > 0}
        />
        <SummaryChip
          icon={Zap}
          label="Falhas"
          value={summary.failed}
          tone={summary.failed > 0 ? "red" : "muted"}
        />
        <SummaryChip
          icon={AlertTriangle}
          label="Conflitos"
          value={summary.conflictsOpen}
          tone={summary.conflictsOpen > 0 ? "amber" : "muted"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> Integrações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma integração configurada.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((i) => {
                const needsAction = (i.failed_jobs ?? 0) > 0 || i.health_status === "down";
                const isRetrying =
                  retryMut.isPending && retryMut.variables === i.integration_id;
                return (
                  <div
                    key={i.integration_id}
                    className="rounded-lg border p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium capitalize truncate">
                          {i.provider}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({i.connector_type ?? "rest"})
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {i.last_sync_at
                            ? new Date(i.last_sync_at).toLocaleString("pt-BR")
                            : "nunca sincronizado"}
                        </div>
                      </div>
                      {statusBadge(i.health_status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <MiniStat label="Pendentes" value={i.pending_jobs ?? 0} />
                      <MiniStat
                        label="Falhos"
                        value={i.failed_jobs ?? 0}
                        tone={(i.failed_jobs ?? 0) > 0 ? "red" : undefined}
                      />
                      <MiniStat
                        label="Conflitos"
                        value={i.open_conflicts ?? 0}
                        tone={(i.open_conflicts ?? 0) > 0 ? "amber" : undefined}
                      />
                      <MiniStat
                        label="Latência"
                        value={i.latency_ms != null ? `${i.latency_ms}ms` : "—"}
                      />
                    </div>
                    {i.last_error && (
                      <div className="text-xs text-destructive flex items-start gap-1 rounded border border-destructive/30 bg-destructive/5 p-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="break-words">{i.last_error}</span>
                      </div>
                    )}
                    {needsAction && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2"
                        disabled={isRetrying}
                        onClick={() => retryMut.mutate(i.integration_id)}
                      >
                        {isRetrying ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        {isRetrying ? "Enfileirando..." : "Retentar sincronização"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" /> Conflitos abertos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {conflicts.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (conflicts.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Nenhum conflito pendente.
            </p>
          ) : (
            <div className="space-y-2">
              {(conflicts.data!.items as Conflict[]).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c)}
                  className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-medium capitalize">{c.resource}</span>
                      <span className="text-muted-foreground">
                        {" "}· ext_id={c.external_id}
                      </span>
                      {c.field && (
                        <span className="text-muted-foreground">
                          {" "}· campo <b>{c.field}</b>
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.detected_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-muted px-2 py-1 truncate">
                      CRM: {JSON.stringify(c.crm_value)}
                    </div>
                    <div className="rounded bg-muted px-2 py-1 truncate">
                      ERP: {JSON.stringify(c.erp_value)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!active}
        onOpenChange={(o) => {
          if (!o) {
            setActive(null);
            setNotes("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver conflito</DialogTitle>
            <DialogDescription>
              {active?.resource} · {active?.field ?? "—"} · {active?.external_id}
            </DialogDescription>
          </DialogHeader>
          {active && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border p-2">
                  <div className="text-xs text-muted-foreground mb-1">Valor no CRM</div>
                  <pre className="text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(active.crm_value, null, 2)}
                  </pre>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-muted-foreground mb-1">Valor no ERP</div>
                  <pre className="text-xs whitespace-pre-wrap break-all">
                    {JSON.stringify(active.erp_value, null, 2)}
                  </pre>
                </div>
              </div>
              <Textarea
                placeholder="Notas (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ resolution: "ignore" })}
            >
              Ignorar
            </Button>
            <Button
              variant="outline"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ resolution: "merge" })}
            >
              Mesclar
            </Button>
            <Button
              variant="secondary"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ resolution: "use_crm" })}
            >
              Manter CRM
            </Button>
            <Button
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ resolution: "use_erp" })}
            >
              Manter ERP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryChip({
  icon: Icon,
  label,
  value,
  tone,
  spinning,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "green" | "amber" | "red" | "muted";
  spinning?: boolean;
}) {
  const color =
    tone === "green"
      ? "text-emerald-600 bg-emerald-500/10"
      : tone === "amber"
      ? "text-amber-600 bg-amber-500/10"
      : tone === "red"
      ? "text-destructive bg-destructive/10"
      : "text-muted-foreground bg-muted";
  return (
    <div className="rounded-md border p-3 flex items-center gap-2.5">
      <div
        className={`h-8 w-8 rounded-md flex items-center justify-center ${color}`}
      >
        <Icon className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-semibold leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-1 truncate">
          {label}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "red" | "amber";
}) {
  const color =
    tone === "red"
      ? "text-destructive"
      : tone === "amber"
      ? "text-amber-700 dark:text-amber-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-muted/30 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
