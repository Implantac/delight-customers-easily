import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { listErpHealth, listErpConflicts, resolveErpConflict } from "@/lib/erp-health.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/integrations/health")({
  component: HealthCenterPage,
});

type Conflict = {
  id: string; integration_id: string; resource: string; external_id: string;
  field: string | null; crm_value: unknown; erp_value: unknown; detected_at: string;
};

function statusBadge(s: string) {
  const map: Record<string, string> = {
    healthy: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    degraded: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    down: "bg-destructive/15 text-destructive border-destructive/30",
    unknown: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={map[s] ?? map.unknown}>{s}</Badge>;
}

function HealthCenterPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const healthFn = useServerFn(listErpHealth);
  const conflictsFn = useServerFn(listErpConflicts);
  const resolveFn = useServerFn(resolveErpConflict);

  const health = useQuery({
    queryKey: ["erp-health", orgId],
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
      resolveFn({ data: { organization_id: orgId!, conflict_id: active!.id, resolution: v.resolution, notes: notes || undefined } }),
    onSuccess: () => {
      toast.success("Conflito resolvido");
      setActive(null); setNotes("");
      qc.invalidateQueries({ queryKey: ["erp-conflicts", orgId] });
      qc.invalidateQueries({ queryKey: ["erp-health", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="ERP Health Center"
        subtitle="Status das integrações comerciais com o ERP e resolução de conflitos."
        action={
          <Button variant="outline" size="sm" onClick={() => { health.refetch(); conflicts.refetch(); }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> Integrações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (health.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma integração configurada.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {health.data!.items.map((i) => (
                <div key={i.integration_id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium capitalize">{i.provider} <span className="text-xs text-muted-foreground">({i.connector_type ?? "rest"})</span></div>
                      <div className="text-xs text-muted-foreground">
                        Última sync: {i.last_sync_at ? new Date(i.last_sync_at).toLocaleString() : "nunca"}
                      </div>
                    </div>
                    {statusBadge(i.health_status)}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Pendentes: <b className="text-foreground">{i.pending_jobs}</b></span>
                    <span>Falhos: <b className="text-foreground">{i.failed_jobs}</b></span>
                    <span>Conflitos: <b className="text-foreground">{i.open_conflicts}</b></span>
                    {i.latency_ms != null && <span>Latência: <b className="text-foreground">{i.latency_ms}ms</b></span>}
                  </div>
                  {i.last_error && (
                    <div className="text-xs text-destructive flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="truncate">{i.last_error}</span>
                    </div>
                  )}
                </div>
              ))}
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
                      <span className="text-muted-foreground"> · ext_id={c.external_id}</span>
                      {c.field && <span className="text-muted-foreground"> · campo <b>{c.field}</b></span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(c.detected_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-muted px-2 py-1 truncate">CRM: {JSON.stringify(c.crm_value)}</div>
                    <div className="rounded bg-muted px-2 py-1 truncate">ERP: {JSON.stringify(c.erp_value)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => { if (!o) { setActive(null); setNotes(""); } }}>
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
                  <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(active.crm_value, null, 2)}</pre>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-muted-foreground mb-1">Valor no ERP</div>
                  <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(active.erp_value, null, 2)}</pre>
                </div>
              </div>
              <Textarea placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ resolution: "ignore" })}>Ignorar</Button>
            <Button variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ resolution: "merge" })}>Mesclar</Button>
            <Button variant="secondary" disabled={resolve.isPending} onClick={() => resolve.mutate({ resolution: "use_crm" })}>Manter CRM</Button>
            <Button disabled={resolve.isPending} onClick={() => resolve.mutate({ resolution: "use_erp" })}>Manter ERP</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
