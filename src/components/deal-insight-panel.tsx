import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { getDealInsight } from "@/lib/copilot-advanced.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Action = { title: string; why: string; priority: "low" | "medium" | "high" };
type Insight = {
  summary: string | null;
  risk_level: "low" | "medium" | "high" | null;
  risk_reason: string | null;
  win_probability: number | null;
  next_actions: Action[];
  generated_at: string;
};

const RISK_STYLES: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  high: "bg-destructive/15 text-destructive",
};

export function DealInsightPanel({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(getDealInsight);
  const [generating, setGenerating] = useState(false);

  const q = useQuery({
    queryKey: ["deal-insight", dealId],
    queryFn: () => fn({ data: { deal_id: dealId } }),
    enabled: !!dealId,
    staleTime: 60_000,
  });

  const regen = useMutation({
    mutationFn: async () => {
      setGenerating(true);
      try {
        return await fn({ data: { deal_id: dealId, force: true } });
      } finally {
        setGenerating(false);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal-insight", dealId] });
      toast.success("Insight atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const insight = q.data?.insight as Insight | undefined;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Insight IA do Negócio
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={() => regen.mutate()} disabled={generating || q.isLoading}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading && <p className="text-sm text-muted-foreground">Analisando…</p>}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
        {insight && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {insight.risk_level && (
                <Badge className={RISK_STYLES[insight.risk_level]}>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Risco {insight.risk_level === "low" ? "baixo" : insight.risk_level === "medium" ? "médio" : "alto"}
                </Badge>
              )}
              {typeof insight.win_probability === "number" && (
                <Badge variant="outline">
                  {Number(insight.win_probability).toFixed(0)}% de chance
                </Badge>
              )}
            </div>
            {insight.summary && <p className="text-sm">{insight.summary}</p>}
            {insight.risk_reason && (
              <p className="text-xs text-muted-foreground">
                <strong>Por quê:</strong> {insight.risk_reason}
              </p>
            )}
            {insight.next_actions?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Próximas ações</p>
                <ul className="space-y-2">
                  {insight.next_actions.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-xs text-muted-foreground">{a.why}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Gerado {new Date(insight.generated_at).toLocaleString("pt-BR")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
