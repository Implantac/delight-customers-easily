import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { getErpHealth } from "@/lib/erp-hub.functions";
import { FRIENDLY_ERPS, statusLabel } from "@/lib/connect-hub";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug, Plus, HelpCircle, Settings2, Activity, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/integrations")({ component: ConnectHubDashboard });

function ConnectHubDashboard() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const fetchHealth = useServerFn(getErpHealth);
  const health = useQuery({
    queryKey: ["erp-health", orgId],
    queryFn: () => fetchHealth({ data: { organization_id: orgId! } }),
    enabled: !!orgId,
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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Hero */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
        <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Plug className="h-6 w-6" />
              <span className="text-sm font-medium uppercase tracking-wide">ConnectHub</span>
            </div>
            <h1 className="text-3xl font-semibold">Conecte seu ERP em poucos minutos</h1>
            <p className="text-muted-foreground max-w-xl">
              Escolha seu ERP, informe os dados de acesso e o CRM organiza tudo para você.
              Sem precisar entender de banco de dados, API ou integração.
            </p>
          </div>
          <Link to="/integrations/connect">
            <Button size="lg" className="gap-2">
              <Plus className="h-5 w-5" /> Conectar novo ERP
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* ERPs conectados */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Seus ERPs conectados</h2>
        {health.isLoading && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Carregando...</CardContent></Card>
        )}
        {!health.isLoading && rows.length === 0 && (
          <Card>
            <CardContent className="p-10 text-center space-y-3">
              <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Plug className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium">Nenhum ERP conectado ainda</p>
              <p className="text-sm text-muted-foreground">Comece conectando seu primeiro ERP.</p>
              <Link to="/integrations/connect">
                <Button className="gap-2"><Plus className="h-4 w-4" /> Conectar novo ERP</Button>
              </Link>
            </CardContent>
          </Card>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const friendly = FRIENDLY_ERPS.find((f) => f.id === r.provider);
            const st = statusLabel(r.status);
            return (
              <Card key={r.provider}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-xl">{friendly?.logo ?? "🔌"}</span>
                      {friendly?.name ?? r.provider}
                    </CardTitle>
                    <Badge variant="outline" className={
                      st.tone === "green" ? "border-green-500/40 text-green-700 dark:text-green-400" :
                      st.tone === "yellow" ? "border-amber-500/40 text-amber-700 dark:text-amber-400" :
                      st.tone === "red" ? "border-red-500/40 text-red-700 dark:text-red-400" :
                      "border-muted-foreground/40 text-muted-foreground"
                    }>
                      {st.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {r.last_sync_at
                      ? `Última sincronização: ${new Date(r.last_sync_at).toLocaleString("pt-BR")}`
                      : "Nunca sincronizado"}
                  </div>
                  {(r.contacts_synced > 0 || r.companies_synced > 0) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      {r.contacts_synced} clientes · {r.companies_synced} empresas
                    </div>
                  )}
                  {r.last_error && (
                    <p className="text-xs text-red-600 line-clamp-2">{r.last_error}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Saúde geral */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Saúde da conexão
          </CardTitle>
          <CardDescription>Visão rápida do status de todos os ERPs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Stat label="Conectados" value={rows.filter((r) => r.status === "online").length} tone="green" />
            <Stat label="Precisam atenção" value={rows.filter((r) => r.status === "degraded").length} tone="yellow" />
            <Stat label="Desconectados" value={rows.filter((r) => r.status === "offline").length} tone="red" />
            <Stat label="Total" value={rows.length} tone="gray" />
          </div>
        </CardContent>
      </Card>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <Link to="/integrations/help">
          <Button variant="ghost" className="gap-2">
            <HelpCircle className="h-4 w-4" /> Preciso de ajuda
          </Button>
        </Link>
        <Link to="/integrations/advanced">
          <Button variant="ghost" className="gap-2 text-muted-foreground">
            <Settings2 className="h-4 w-4" /> Configurações avançadas
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "green" | "yellow" | "red" | "gray" }) {
  const color =
    tone === "green" ? "text-green-600" :
    tone === "yellow" ? "text-amber-600" :
    tone === "red" ? "text-red-600" : "text-muted-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
