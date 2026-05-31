import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  predictRepurchasePropensity,
  predictChurnPropensity,
  indexCustomerEmbeddings,
} from "@/lib/propensity.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, RefreshCw, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Props = {
  organizationId: string;
  erpCustomerId: string;
};

/**
 * Painel reutilizável de propensão (recompra + churn) baseado em embeddings.
 * Usado no Customer 360 / detalhe da empresa.
 */
export function PropensityPanel({ organizationId, erpCustomerId }: Props) {
  const repFn = useServerFn(predictRepurchasePropensity);
  const churnFn = useServerFn(predictChurnPropensity);
  const indexFn = useServerFn(indexCustomerEmbeddings);
  const [needsIndex, setNeedsIndex] = useState(false);

  const repQ = useQuery({
    queryKey: ["propensity-rep", organizationId, erpCustomerId],
    enabled: !!organizationId && !!erpCustomerId,
    retry: false,
    queryFn: () =>
      repFn({ data: { organization_id: organizationId, erp_customer_id: erpCustomerId } }),
  });
  const churnQ = useQuery({
    queryKey: ["propensity-churn", organizationId, erpCustomerId],
    enabled: !!organizationId && !!erpCustomerId,
    retry: false,
    queryFn: () =>
      churnFn({ data: { organization_id: organizationId, erp_customer_id: erpCustomerId } }),
  });

  const needsEmbedding =
    (repQ.error && /sem embedding/i.test((repQ.error as Error).message)) ||
    (churnQ.error && /sem embedding/i.test((churnQ.error as Error).message)) ||
    needsIndex;

  const indexM = useMutation({
    mutationFn: () =>
      indexFn({ data: { organization_id: organizationId, limit: 5, force: true } }),
    onSuccess: () => {
      toast.success("Indexação disparada — refaça as predições em alguns segundos.");
      setNeedsIndex(false);
      repQ.refetch();
      churnQ.refetch();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4" /> Propensão & Risco (IA vetorial)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {needsEmbedding && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">
              Cliente ainda sem embedding indexado.
            </span>
            <Button size="sm" onClick={() => indexM.mutate()} disabled={indexM.isPending}>
              <RefreshCw className={indexM.isPending ? "h-3 w-3 mr-1 animate-spin" : "h-3 w-3 mr-1"} />
              Indexar agora
            </Button>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" /> Propensão de recompra
            </div>
            {repQ.isLoading ? (
              <Skeleton className="h-16" />
            ) : repQ.data ? (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Cell label="Confiança" value={`${Math.round(repQ.data.confidence * 100)}%`} />
                <Cell
                  label="Próx. compra"
                  value={new Date(repQ.data.expected_purchase_at).toLocaleDateString("pt-BR")}
                />
                <Cell label="Ticket" value={`R$ ${repQ.data.expected_value.toFixed(0)}`} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Risco de churn
            </div>
            {churnQ.isLoading ? (
              <Skeleton className="h-16" />
            ) : churnQ.data ? (
              <div className="grid grid-cols-3 gap-2 text-xs items-center">
                <Cell label="Risco" value={`${Math.round(churnQ.data.churn_risk * 100)}%`} />
                <div>
                  <div className="text-muted-foreground">Severidade</div>
                  <Badge
                    variant={
                      churnQ.data.severity === "high"
                        ? "destructive"
                        : churnQ.data.severity === "medium"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {churnQ.data.severity}
                  </Badge>
                </div>
                <Cell
                  label="Pares"
                  value={`${churnQ.data.similar_churned}/${churnQ.data.similar_total}`}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem dados.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
