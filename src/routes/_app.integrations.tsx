import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { getErpHealth } from "@/lib/erp-hub.functions";
import { enqueueErpSync, listErpSyncJobs } from "@/lib/connect-hub.functions";
import { getErpSchedule, updateErpSchedule, FREQ_LABELS, type ScheduleFreq } from "@/lib/erp-schedule.functions";
import { FRIENDLY_ERPS, statusLabel } from "@/lib/connect-hub";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import {
  Plug,
  Plus,
  HelpCircle,
  Settings2,
  Activity,
  Clock,
  CheckCircle2,
  RefreshCw,
  Inbox,
  FileText,
  AppWindow,
  Server,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Calendar,
  GitBranch,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/_app/integrations")({
  component: ConnectHubDashboard,
});

const QUICK_LINKS = [
  { to: "/integrations/dashboard" as const, icon: BarChart3, label: "Dashboard", desc: "KPIs e SLA" },
  { to: "/integrations/health" as const, icon: Activity, label: "Saúde", desc: "Status em tempo real" },
  { to: "/integrations/mapping" as const, icon: GitBranch, label: "Mapeamento", desc: "Campos ERP↔CRM" },
  { to: "/integrations/outbox" as const, icon: Inbox, label: "Fila", desc: "Envios e retries" },
  { to: "/integrations/templates" as const, icon: FileText, label: "Templates", desc: "Mapeamentos prontos" },
  { to: "/integrations/apps" as const, icon: AppWindow, label: "Apps", desc: "Conectores extras" },
];

type SyncResource =
  | "customers"
  | "sales_reps"
  | "sales_history"
  | "products"
  | "metrics";

const RESOURCE_OPTIONS: Array<{
  id: SyncResource;
  label: string;
  desc: string;
  default: boolean;
}> = [
  { id: "customers", label: "Clientes", desc: "Cadastros do ERP", default: true },
  {
    id: "sales_history",
    label: "Histórico comercial",
    desc: "Pedidos e vendas",
    default: true,
  },
  {
    id: "sales_reps",
    label: "Representantes",
    desc: "Vendedores e equipes",
    default: false,
  },
  { id: "products", label: "Produtos", desc: "Catálogo comercial", default: false },
  {
    id: "metrics",
    label: "Métricas",
    desc: "RFM, ticket médio, frequência",
    default: false,
  },
];

function ConnectHubDashboard() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const fetchHealth = useServerFn(getErpHealth);
  const enqueueSync = useServerFn(enqueueErpSync);
  const fetchJobs = useServerFn(listErpSyncJobs);

  const [syncDialog, setSyncDialog] = useState<{
    integrationId: string;
    providerName: string;
  } | null>(null);
  const [selectedResources, setSelectedResources] = useState<
    Record<SyncResource, boolean>
  >({
    customers: true,
    sales_history: true,
    sales_reps: false,
    products: false,
    metrics: false,
  });
  const [direction, setDirection] = useState<"pull" | "push">("pull");

  const health = useQuery({
    queryKey: ["erp-health", orgId],
    queryFn: () => fetchHealth({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  // Jobs em andamento para badges de progresso nos cards
  const jobs = useQuery({
    queryKey: ["erp-jobs-open", orgId],
    queryFn: () =>
      fetchJobs({
        data: { organizationId: orgId!, limit: 100 },
      }),
    enabled: !!orgId,
    refetchInterval: 10_000,
  });

  const openJobsByIntegration = useMemo(() => {
    const map = new Map<string, { pending: number; running: number }>();
    for (const j of jobs.data?.rows ?? []) {
      if (j.status === "pending" || j.status === "running") {
        const cur = map.get(j.integration_id) ?? { pending: 0, running: 0 };
        if (j.status === "pending") cur.pending++;
        else cur.running++;
        map.set(j.integration_id, cur);
      }
    }
    return map;
  }, [jobs.data]);

  const syncMut = useMutation({
    mutationFn: (vars: {
      integrationId: string;
      resources: SyncResource[];
      direction: "pull" | "push";
    }) =>
      enqueueSync({
        data: {
          organizationId: orgId!,
          integrationId: vars.integrationId,
          resources: vars.resources,
          direction: vars.direction,
        },
      }),
    onSuccess: (data) => {
      toast.success("Sincronização iniciada", {
        description: `${data.jobs.length} job(s) na fila. Os cards atualizam em instantes.`,
      });
      setSyncDialog(null);
      // Atualiza jobs imediatamente e health em intervalos
      qc.invalidateQueries({ queryKey: ["erp-jobs-open", orgId] });
      setTimeout(
        () => qc.invalidateQueries({ queryKey: ["erp-health", orgId] }),
        1500,
      );
      setTimeout(
        () => qc.invalidateQueries({ queryKey: ["erp-health", orgId] }),
        6000,
      );
      setTimeout(
        () => qc.invalidateQueries({ queryKey: ["erp-health", orgId] }),
        15000,
      );
    },
    onError: (e: any) =>
      toast.error("Não foi possível iniciar a sincronização", {
        description: e?.message ?? "Tente novamente em instantes.",
      }),
  });

  function openSyncDialog(integrationId: string, providerName: string) {
    setSelectedResources({
      customers: true,
      sales_history: true,
      sales_reps: false,
      products: false,
      metrics: false,
    });
    setDirection("pull");
    setSyncDialog({ integrationId, providerName });
  }

  function confirmSync() {
    if (!syncDialog) return;
    const resources = (Object.keys(selectedResources) as SyncResource[]).filter(
      (k) => selectedResources[k],
    );
    if (resources.length === 0) {
      toast.error("Selecione ao menos um recurso para sincronizar.");
      return;
    }
    syncMut.mutate({
      integrationId: syncDialog.integrationId,
      resources,
      direction,
    });
  }

  if (!canManage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Você não tem acesso ao ConnectHub. Fale com um administrador.
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = (health.data?.rows ?? []).filter((r) => r.is_configured);
  const online = rows.filter((r) => r.status === "online").length;
  const degraded = rows.filter((r) => r.status === "degraded").length;
  const offline = rows.filter((r) => r.status === "offline").length;
  const needsAttention = degraded + offline;

  const totalOpenJobs = Array.from(openJobsByIntegration.values()).reduce(
    (acc, v) => acc + v.pending + v.running,
    0,
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        icon={Plug}
        title="ConnectHub"
        subtitle="Conecte, sincronize e monitore seus ERPs em um só lugar."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                health.refetch();
                jobs.refetch();
              }}
              disabled={health.isFetching}
            >
              <RefreshCw
                className={`h-4 w-4 ${health.isFetching ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
            <Link to="/integrations/connect">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Conectar ERP
              </Button>
            </Link>
          </div>
        }
      />

      {/* Resumo de status */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ERPs conectados" value={rows.length} tone="primary" icon={Plug} />
        <StatCard label="Online" value={online} tone="green" icon={CheckCircle2} />
        <StatCard
          label="Precisa atenção"
          value={needsAttention}
          tone="amber"
          icon={AlertTriangle}
        />
        <StatCard
          label="Jobs em andamento"
          value={totalOpenJobs}
          tone={totalOpenJobs > 0 ? "primary" : "muted"}
          icon={Loader2}
          spinning={totalOpenJobs > 0}
        />
      </div>

      {/* Quick links */}
      <Card>
        <CardContent className="p-2">
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-5">
            {QUICK_LINKS.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent transition-colors"
              >
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <q.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{q.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{q.desc}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ERPs conectados */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Seus ERPs conectados</h2>
            <p className="text-sm text-muted-foreground">
              Status, última sincronização e ações rápidas por conector.
            </p>
          </div>
          {rows.length > 0 && (
            <Link to="/integrations/health">
              <Button variant="ghost" size="sm" className="gap-1">
                Ver tudo <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        {health.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-5 w-32 bg-muted rounded animate-pulse mb-3" />
                  <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Plug className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">Nenhum ERP conectado ainda</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Comece conectando seu primeiro ERP. Importamos clientes, representantes e histórico comercial — sem mexer em estoque, fiscal ou financeiro.
              </p>
              <Link to="/integrations/connect">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Conectar meu primeiro ERP
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((r) => {
              const friendly = FRIENDLY_ERPS.find((f) => f.id === r.provider);
              const st = statusLabel(r.status);
              const tone =
                st.tone === "green"
                  ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                  : st.tone === "yellow"
                  ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                  : st.tone === "red"
                  ? "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-400"
                  : "border-muted-foreground/40 text-muted-foreground";

              const jobInfo = r.integration_id
                ? openJobsByIntegration.get(r.integration_id)
                : undefined;
              const hasActiveJobs = !!jobInfo && (jobInfo.pending + jobInfo.running) > 0;
              const providerName = friendly?.name ?? r.provider;

              return (
                <Card key={r.provider} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">
                          {friendly?.logo ?? "🔌"}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">
                            {providerName}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {r.latency_ms != null ? `${r.latency_ms} ms` : "—"}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge variant="outline" className={tone}>
                          {st.label}
                        </Badge>
                        {hasActiveJobs && (
                          <Badge
                            variant="outline"
                            className="border-primary/40 bg-primary/5 text-primary gap-1"
                          >
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {jobInfo!.running > 0
                              ? `${jobInfo!.running} rodando`
                              : `${jobInfo!.pending} na fila`}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm pb-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {r.last_sync_at
                          ? `Última sync: ${new Date(r.last_sync_at).toLocaleString("pt-BR")}`
                          : "Nunca sincronizado"}
                      </span>
                    </div>
                    {(r.contacts_synced > 0 || r.companies_synced > 0) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>
                          {r.contacts_synced.toLocaleString("pt-BR")} clientes ·{" "}
                          {r.companies_synced.toLocaleString("pt-BR")} empresas
                        </span>
                      </div>
                    )}
                    {hasActiveJobs && (
                      <div className="flex items-center gap-2 text-xs text-primary">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {jobInfo!.running} rodando · {jobInfo!.pending} na fila
                      </div>
                    )}
                    {r.last_error && (
                      <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-2">
                        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-700 dark:text-red-400 line-clamp-2">
                          {r.last_error}
                        </p>
                      </div>
                    )}

                    <Separator />

                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-xs"
                        disabled={!r.integration_id || !r.is_active}
                        onClick={() =>
                          r.integration_id &&
                          openSyncDialog(r.integration_id, providerName)
                        }
                      >
                        <RefreshCw className="h-3 w-3" />
                        Sincronizar
                      </Button>
                      <Link to="/integrations/outbox">
                        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs">
                          <Inbox className="h-3 w-3" /> Logs
                        </Button>
                      </Link>
                      <Link to="/integrations/connect">
                        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs">
                          <Settings2 className="h-3 w-3" /> Configurar
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/integrations/help">
          <Button variant="ghost" size="sm" className="gap-2">
            <HelpCircle className="h-4 w-4" /> Preciso de ajuda
          </Button>
        </Link>
        <Link to="/integrations/advanced">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Settings2 className="h-4 w-4" /> Configurações avançadas
          </Button>
        </Link>
      </div>

      {/* Dialog de opções de sincronização */}
      <Dialog
        open={!!syncDialog}
        onOpenChange={(o) => !o && !syncMut.isPending && setSyncDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Sincronizar {syncDialog?.providerName}
            </DialogTitle>
            <DialogDescription>
              Escolha o que sincronizar. O ConnectHub enfileira um job para cada recurso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Recursos
              </Label>
              <div className="space-y-2 rounded-md border p-3">
                {RESOURCE_OPTIONS.map((opt) => (
                  <div key={opt.id} className="flex items-start gap-3">
                    <Checkbox
                      id={`res-${opt.id}`}
                      checked={selectedResources[opt.id]}
                      onCheckedChange={(c) =>
                        setSelectedResources((prev) => ({
                          ...prev,
                          [opt.id]: !!c,
                        }))
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={`res-${opt.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {opt.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Direção
              </Label>
              <RadioGroup
                value={direction}
                onValueChange={(v) => setDirection(v as "pull" | "push")}
                className="grid grid-cols-2 gap-2"
              >
                <Label
                  htmlFor="dir-pull"
                  className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent"
                >
                  <RadioGroupItem value="pull" id="dir-pull" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">ERP → CRM</div>
                    <div className="text-xs text-muted-foreground">
                      Importar do ERP (padrão)
                    </div>
                  </div>
                </Label>
                <Label
                  htmlFor="dir-push"
                  className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent"
                >
                  <RadioGroupItem value="push" id="dir-push" className="mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">CRM → ERP</div>
                    <div className="text-xs text-muted-foreground">
                      Enviar alterações
                    </div>
                  </div>
                </Label>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSyncDialog(null)}
              disabled={syncMut.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={confirmSync} disabled={syncMut.isPending} className="gap-2">
              {syncMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {syncMut.isPending ? "Enviando..." : "Iniciar sincronização"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  hint,
  spinning,
}: {
  label: string;
  value: number | string;
  tone: "primary" | "green" | "amber" | "muted";
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  spinning?: boolean;
}) {
  const color =
    tone === "primary"
      ? "text-primary bg-primary/10"
      : tone === "green"
      ? "text-emerald-600 bg-emerald-500/10"
      : tone === "amber"
      ? "text-amber-600 bg-amber-500/10"
      : "text-muted-foreground bg-muted";
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-md flex items-center justify-center ${color}`}
        >
          <Icon className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`} />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {hint ?? label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
