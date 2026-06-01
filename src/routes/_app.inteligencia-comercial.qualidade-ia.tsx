import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getAIBacktestMetrics, closeAIPredictionOutcomes, type BacktestMetric } from "@/lib/ai-quality.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, Brain } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/inteligencia-comercial/qualidade-ia")({
  component: QualidadeIAPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-6">
      <p className="text-destructive">Erro: {error.message}</p>
      <Button onClick={reset} className="mt-2">Tentar novamente</Button>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Não encontrado.</div>,
});

const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${(Number(n) * 100).toFixed(1)}%`;

function MetricCard({ title, m }: { title: string; m: BacktestMetric }) {
  if (!m) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">Sem previsões registradas no período.</p>
      </Card>
    );
  }
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="secondary">{m.with_outcome}/{m.total} fechadas</Badge>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div><div className="text-muted-foreground">Acurácia</div><div className="text-lg font-semibold">{pct(m.accuracy)}</div></div>
        <div><div className="text-muted-foreground">Precisão</div><div className="text-lg font-semibold">{pct(m.precision_pos)}</div></div>
        <div><div className="text-muted-foreground">Recall</div><div className="text-lg font-semibold">{pct(m.recall_pos)}</div></div>
        <div><div className="text-muted-foreground">Score médio</div><div>{pct(m.avg_predicted)}</div></div>
        <div><div className="text-muted-foreground">Taxa positiva real</div><div>{pct(m.positive_rate)}</div></div>
      </div>
    </Card>
  );
}

function QualidadeIAPage() {
  const { org } = useCurrentOrg();
  const fetchMetrics = useServerFn(getAIBacktestMetrics);
  const closeFn = useServerFn(closeAIPredictionOutcomes);

  const q = useQuery({
    queryKey: ["ai-backtest", org?.id],
    queryFn: () => fetchMetrics({ data: { orgId: org!.id, sinceDays: 90 } }),
    enabled: !!org?.id,
  });

  const closeMut = useMutation({
    mutationFn: () => closeFn({ data: { orgId: org!.id } }),
    onSuccess: (r) => {
      toast.success(`Fechadas ${r.closed} previsões (churn ${r.churn_closed}, recompra ${r.repurchase_closed})`);
      q.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Qualidade da IA"
        subtitle="Backtesting dos modelos comerciais (últimos 90 dias) contra o histórico real do ERP."
        icon={Brain}
        action={
          <Button onClick={() => closeMut.mutate()} disabled={closeMut.isPending || !org}>
            {closeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Fechar previsões vencidas
          </Button>
        }
      />

      {q.isLoading ? (
        <div className="grid md:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          <MetricCard title="Churn (risco de saída)" m={q.data?.metrics.churn ?? null} />
          <MetricCard title="Recompra (próxima compra)" m={q.data?.metrics.repurchase ?? null} />
          <MetricCard title="Lead Score" m={q.data?.metrics.leadscore ?? null} />
        </div>
      )}

      <Card className="p-5 text-sm text-muted-foreground">
        <p>
          Cada previsão é gravada automaticamente. Após o horizonte vencer (ex.: 30 dias),
          comparamos com <code>erp_sales_history</code>: churn acerta quando NÃO houve compra,
          recompra acerta quando HOUVE. O cron diário às 03:15 fecha automaticamente.
        </p>
      </Card>
    </div>
  );
}
