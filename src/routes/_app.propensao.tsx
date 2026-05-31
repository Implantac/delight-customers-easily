import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import {
  indexCustomerEmbeddings,
  getEmbeddingCoverage,
  predictRepurchasePropensity,
  predictChurnPropensity,
} from "@/lib/propensity.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/propensao")({ component: PropensaoPage });

function PropensaoPage() {
  const { orgId } = useCurrentOrg();
  const coverageFn = useServerFn(getEmbeddingCoverage);
  const indexFn = useServerFn(indexCustomerEmbeddings);
  const repurchaseFn = useServerFn(predictRepurchasePropensity);
  const churnFn = useServerFn(predictChurnPropensity);

  const [customerId, setCustomerId] = useState("");

  const coverageQ = useQuery({
    queryKey: ["embed-coverage", orgId],
    enabled: !!orgId,
    queryFn: () => coverageFn({ data: { organization_id: orgId! } }),
  });

  const indexM = useMutation({
    mutationFn: () => indexFn({ data: { organization_id: orgId!, limit: 25, force: false } }),
    onSuccess: (r) => {
      toast.success(`Indexados ${r.indexed} • Pulados ${r.skipped}`);
      coverageQ.refetch();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const repM = useMutation({
    mutationFn: () => repurchaseFn({ data: { organization_id: orgId!, erp_customer_id: customerId } }),
    onError: (e) => toast.error((e as Error).message),
  });
  const churnM = useMutation({
    mutationFn: () => churnFn({ data: { organization_id: orgId!, erp_customer_id: customerId } }),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Propensão & churn (IA vetorial)"
        subtitle="Embeddings de clientes via pgvector + Lovable AI. Encontra similares e estima propensão de recompra e risco de churn."
        icon={Brain}
      />

      <Card>
        <CardHeader>
          <CardTitle>Cobertura de embeddings</CardTitle>
          <CardDescription>Indexe seus clientes ERP para habilitar predições.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {coverageQ.data && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span>{coverageQ.data.indexed} de {coverageQ.data.total_customers} clientes</span>
                <Badge variant="outline">{coverageQ.data.coverage_pct}%</Badge>
              </div>
              <Progress value={coverageQ.data.coverage_pct} />
            </>
          )}
          <Button onClick={() => indexM.mutate()} disabled={indexM.isPending || !orgId}>
            <RefreshCw className={indexM.isPending ? "h-4 w-4 mr-2 animate-spin" : "h-4 w-4 mr-2"} />
            Indexar próximos 25 clientes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Predição por cliente</CardTitle>
          <CardDescription>Informe o ID do cliente ERP (UUID).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <div>
              <Label>ERP Customer ID</Label>
              <Input placeholder="uuid…" value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
            </div>
            <Button
              variant="outline"
              className="self-end"
              onClick={() => repM.mutate()}
              disabled={!customerId || repM.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />Recompra
            </Button>
            <Button
              variant="outline"
              className="self-end"
              onClick={() => churnM.mutate()}
              disabled={!customerId || churnM.isPending}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />Churn
            </Button>
          </div>

          {repM.data && (
            <Card>
              <CardHeader><CardTitle className="text-base">Propensão de recompra</CardTitle></CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-4 text-sm">
                <KV label="Confiança" value={`${Math.round(repM.data.confidence * 100)}%`} />
                <KV label="Próxima compra" value={new Date(repM.data.expected_purchase_at).toLocaleDateString("pt-BR")} />
                <KV label="Ticket esperado" value={`R$ ${repM.data.expected_value.toFixed(2)}`} />
                <KV label="Pares ativos" value={String(repM.data.signals.active_peers)} />
              </CardContent>
            </Card>
          )}

          {churnM.data && (
            <Card>
              <CardHeader><CardTitle className="text-base">Risco de churn</CardTitle></CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-4 text-sm">
                <KV label="Risco" value={`${Math.round(churnM.data.churn_risk * 100)}%`} />
                <KV label="Severidade" value={churnM.data.severity.toUpperCase()} />
                <KV label="Pares churn" value={`${churnM.data.similar_churned}/${churnM.data.similar_total}`} />
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
