import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Trophy, TrendingDown, Clock, Target, AlertTriangle, Sparkles, Loader2, Lightbulb } from "lucide-react";
import { getWinLossIntel } from "@/lib/winloss.functions";
import { getWinLossPlan, type WinLossInsight } from "@/lib/winloss-ai.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/win-loss")({ component: WinLossPage });

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const PCT = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString("pt-BR") : "—";

function WinLossPage() {
  const { orgId } = useCurrentOrg();
  const call = useServerFn(getWinLossIntel);
  const { data, isLoading } = useQuery({
    queryKey: ["winloss", orgId],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId!, days: 180 } }),
    refetchOnWindowFocus: false,
  });

  const planFn = useServerFn(getWinLossPlan);
  const planMut = useMutation({
    mutationFn: () => planFn({ data: { organization_id: orgId!, days: 180 } }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar plano com IA"),
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={Trophy}
        title="Win/Loss Analysis"
        subtitle="Entenda por que você vende — e por que perde. Últimos 180 dias."
        actions={
          <Button onClick={() => planMut.mutate()} disabled={planMut.isPending || !orgId} className="gap-2">
            {planMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {planMut.isPending ? "Analisando..." : "Análise com IA"}
          </Button>
        }
      />

      {planMut.data && <AiPlanCard plan={planMut.data} />}

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" />Win Rate</div>
              <div className="mt-2 text-3xl font-semibold">{PCT(data.summary.winRate)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{data.summary.wonCount} ganhos / {data.summary.lostCount} perdidos</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5 text-emerald-500" />Receita ganha</div>
              <div className="mt-2 text-3xl font-semibold">{BRL(data.summary.wonValue)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{data.summary.wonCount} negócios</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingDown className="h-3.5 w-3.5 text-red-500" />Receita perdida</div>
              <div className="mt-2 text-3xl font-semibold">{BRL(data.summary.lostValue)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{data.summary.lostCount} negócios</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />Ciclo médio</div>
              <div className="mt-2 text-3xl font-semibold">{data.summary.avgCycleDays}d</div>
              <div className="mt-1 text-xs text-muted-foreground">do lead ao fechamento (won)</div>
            </Card>
          </div>

          {data.topLossReason && (
            <Card className="border-amber-500/40 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold">Principal motivo de perda</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{data.topLossReason.reason}</span> custou{" "}
                    <span className="font-semibold text-red-500">{BRL(data.topLossReason.value)}</span> em {data.topLossReason.count} negócios.
                    Atuar nesse motivo é a maior alavanca de receita.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Tabs defaultValue="reasons">
            <TabsList>
              <TabsTrigger value="reasons">Motivos</TabsTrigger>
              <TabsTrigger value="users">Performance</TabsTrigger>
              <TabsTrigger value="recent">Histórico recente</TabsTrigger>
            </TabsList>

            <TabsContent value="reasons" className="mt-4">
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Resultado</th>
                      <th className="px-4 py-2 text-left">Motivo</th>
                      <th className="px-4 py-2 text-right">Negócios</th>
                      <th className="px-4 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reasons.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhum motivo registrado ainda. Preencha o motivo ao fechar negócios.</td></tr>
                    ) : data.reasons.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-2">
                          <Badge variant={r.outcome === "won" ? "default" : "destructive"}>
                            {r.outcome === "won" ? "Ganho" : "Perdido"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">{r.reason}</td>
                        <td className="px-4 py-2 text-right">{r.count}</td>
                        <td className="px-4 py-2 text-right font-medium">{BRL(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="mt-4">
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Vendedor</th>
                      <th className="px-4 py-2 text-right">Win rate</th>
                      <th className="px-4 py-2">Ratio</th>
                      <th className="px-4 py-2 text-right">Ganhou</th>
                      <th className="px-4 py-2 text-right">Perdeu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.userPerf.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Sem dados.</td></tr>
                    ) : data.userPerf.map((u) => (
                      <tr key={u.user_id} className="border-t">
                        <td className="px-4 py-2 font-medium">{u.name}</td>
                        <td className="px-4 py-2 text-right">{PCT(u.winRate)}</td>
                        <td className="px-4 py-2 w-48"><Progress value={u.winRate * 100} className="h-2" /></td>
                        <td className="px-4 py-2 text-right text-emerald-500">{BRL(u.wonValue)}</td>
                        <td className="px-4 py-2 text-right text-red-500">{BRL(u.lostValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </TabsContent>

            <TabsContent value="recent" className="mt-4">
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Negócio</th>
                      <th className="px-4 py-2 text-left">Resultado</th>
                      <th className="px-4 py-2 text-left">Motivo</th>
                      <th className="px-4 py-2 text-right">Valor</th>
                      <th className="px-4 py-2 text-right">Fechado em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentDeals.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Sem negócios fechados no período.</td></tr>
                    ) : data.recentDeals.map((d) => (
                      <tr key={d.id} className="border-t">
                        <td className="px-4 py-2">
                          <Link to="/pipeline" className="font-medium hover:underline">{d.title}</Link>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant={d.stage === "won" ? "default" : "destructive"}>
                            {d.stage === "won" ? "Ganho" : "Perdido"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{d.outcome_reason ?? "—"}</td>
                        <td className="px-4 py-2 text-right">{BRL(Number(d.value || 0))}</td>
                        <td className="px-4 py-2 text-right text-xs text-muted-foreground">{fmtDate(d.closed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
