import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { RequireManager } from "@/components/require-manager";
import { PageHeader } from "@/components/page-header";
import { listAutomationRuns } from "@/lib/automations.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, XCircle, Minus, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/settings/automations/runs")({
  component: () => <RequireManager><RunsPage /></RequireManager>,
});

function RunsPage() {
  const { orgId } = useCurrentOrg();
  const listFn = useServerFn(listAutomationRuns);
  const q = useQuery({
    queryKey: ["automation-runs", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId!, limit: 100 } }),
    enabled: !!orgId,
    refetchInterval: 15000,
  });

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <PageHeader
        title="Execuções de Automações"
        subtitle="Histórico das últimas 100 execuções (todas as regras)."
        icon={Activity}
        action={
          <Link to="/settings/automations"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></Link>
        }
      />

      {q.isLoading && <Card className="p-6 text-sm text-muted-foreground">Carregando…</Card>}
      {q.data?.runs.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma execução registrada ainda. Quando uma automação rodar, aparecerá aqui.
        </Card>
      )}

      <div className="space-y-2">
        {q.data?.runs.map((r: any) => (
          <Card key={r.id} className="p-3 flex items-center gap-3">
            <StatusIcon status={r.status} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {r.automations?.name ?? "—"} <span className="text-muted-foreground">· {r.trigger_event}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {r.automations?.action_type} · {r.duration_ms ?? 0}ms ·{" "}
                {formatDistanceToNow(new Date(r.started_at), { addSuffix: true, locale: ptBR })}
              </div>
              {r.error && <div className="text-xs text-destructive mt-1 font-mono truncate">{r.error}</div>}
            </div>
            <StatusBadge status={r.status} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
  if (status === "error") return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
  return <Minus className="h-5 w-5 text-muted-foreground shrink-0" />;
}
function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Sucesso</Badge>;
  if (status === "error") return <Badge variant="destructive">Erro</Badge>;
  return <Badge variant="outline">Ignorada</Badge>;
}
