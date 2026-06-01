import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { getErpHealth } from "@/lib/erp-hub.functions";
import { enqueueErpSync } from "@/lib/connect-hub.functions";
import { FRIENDLY_ERPS, statusLabel } from "@/lib/connect-hub";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";

export const Route = createFileRoute("/_app/integrations")({ component: ConnectHubDashboard });

const QUICK_LINKS = [
  { to: "/integrations/health" as const, icon: Activity, label: "Saúde", desc: "Status em tempo real" },
  { to: "/integrations/outbox" as const, icon: Inbox, label: "Fila de eventos", desc: "Envios e retries" },
  { to: "/integrations/templates" as const, icon: FileText, label: "Templates", desc: "Mapeamentos prontos" },
  { to: "/integrations/apps" as const, icon: AppWindow, label: "Apps", desc: "Conectores extras" },
  { to: "/settings/erp-agent" as const, icon: Server, label: "Agente local", desc: "ERPs on-premise" },
];

function ConnectHubDashboard() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const fetchHealth = useServerFn(getErpHealth);
  const enqueueSync = useServerFn(enqueueErpSync);
  const health = useQuery({
    queryKey: ["erp-health", orgId],
    queryFn: () => fetchHealth({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
    refetchInterval: 60_000,
  });

  const syncMut = useMutation({
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
      toast.success("Sincronização iniciada", {
        description: "Os cards serão atualizados em instantes.",
      });
      // Refresh health a few times to catch the sync completing
      setTimeout(() => qc.invalidateQueries({ queryKey: ["erp-health", orgId] }), 1500);
      setTimeout(() => qc.invalidateQueries({ queryKey: ["erp-health", orgId] }), 6000);
      setTimeout(() => qc.invalidateQueries({ queryKey: ["erp-health", orgId] }), 15000);
    },
    onError: (e: any) =>
      toast.error("Não foi possível iniciar a sincronização", {
        description: e?.message ?? "Tente novamente em instantes.",
      }),
  });


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
              onClick={() => health.refetch()}
              disabled={health.isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${health.isFetching ? "animate-spin" : ""}`} />
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
        <StatCard label="Precisa atenção" value={needsAttention} tone="amber" icon={AlertTriangle} />
        <StatCard label="Total de eventos hoje" value={"—"} tone="muted" icon={Activity} hint="Veja em Saúde" />
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
            <p className="text-sm text-muted-foreground">Status, última sincronização e ações rápidas por conector.</p>
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
                            {friendly?.name ?? r.provider}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {r.latency_ms != null ? `${r.latency_ms} ms` : "—"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className={tone}>
                        {st.label}
                      </Badge>
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
                      <Link to="/integrations/health">
                        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
                          <RefreshCw className="h-3 w-3" /> Sincronizar
                        </Button>
                      </Link>
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
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  tone: "primary" | "green" | "amber" | "muted";
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
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
        <div className={`h-10 w-10 rounded-md flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1 truncate">{hint ?? label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
