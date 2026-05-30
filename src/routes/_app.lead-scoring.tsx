import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Snowflake, Thermometer, TrendingUp } from "lucide-react";
import { getLeadScores } from "@/lib/leadscore.functions";

export const Route = createFileRoute("/_app/lead-scoring")({ component: LeadScoringPage });

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function tierBadge(tier: "hot" | "warm" | "cold") {
  if (tier === "hot") return <Badge className="bg-red-500/15 text-red-500 hover:bg-red-500/15"><Flame className="mr-1 h-3 w-3" />Quente</Badge>;
  if (tier === "warm") return <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/15"><Thermometer className="mr-1 h-3 w-3" />Morno</Badge>;
  return <Badge variant="outline" className="text-muted-foreground"><Snowflake className="mr-1 h-3 w-3" />Frio</Badge>;
}

function LeadScoringPage() {
  const { orgId } = useCurrentOrg();
  const [tab, setTab] = useState<"all" | "hot" | "warm" | "cold">("all");
  const call = useServerFn(getLeadScores);
  const { data, isLoading } = useQuery({
    queryKey: ["lead-scores", orgId],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId!, limit: 200 } }),
    refetchOnWindowFocus: false,
  });

  const filtered = (data?.items ?? []).filter((x) => tab === "all" || x.tier === tab);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Lead Scoring"
        subtitle="Onde focar agora. Cada contato é pontuado por engajamento, valor e recência."
      />

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Flame className="h-3.5 w-3.5 text-red-500" />Leads quentes</div>
              <div className="mt-2 text-3xl font-semibold">{data.summary.hot}</div>
              <div className="mt-1 text-xs text-muted-foreground">Atender hoje</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Thermometer className="h-3.5 w-3.5 text-amber-500" />Leads mornos</div>
              <div className="mt-2 text-3xl font-semibold">{data.summary.warm}</div>
              <div className="mt-1 text-xs text-muted-foreground">Reaquecer essa semana</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Snowflake className="h-3.5 w-3.5" />Leads frios</div>
              <div className="mt-2 text-3xl font-semibold">{data.summary.cold}</div>
              <div className="mt-1 text-xs text-muted-foreground">Nutrir ou arquivar</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />Pipeline quente</div>
              <div className="mt-2 text-3xl font-semibold">{BRL(data.summary.hotPipeline)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Valor em jogo nos quentes</div>
            </Card>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Todos ({data.summary.total})</TabsTrigger>
              <TabsTrigger value="hot">Quentes ({data.summary.hot})</TabsTrigger>
              <TabsTrigger value="warm">Mornos ({data.summary.warm})</TabsTrigger>
              <TabsTrigger value="cold">Frios ({data.summary.cold})</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4">
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Contato</th>
                      <th className="px-4 py-2 text-left">Empresa</th>
                      <th className="px-4 py-2 text-center">Score</th>
                      <th className="px-4 py-2 text-center">Tier</th>
                      <th className="px-4 py-2 text-right">Pipeline</th>
                      <th className="px-4 py-2 text-left">Sinais</th>
                      <th className="px-4 py-2 text-left">Próximo passo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Nenhum contato neste filtro.</td></tr>
                    ) : filtered.map((c) => (
                      <tr key={c.contact_id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <Link to="/contacts/$id" params={{ id: c.contact_id }} className="font-medium hover:underline">{c.name}</Link>
                          {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.company_id ? (
                            <Link to="/companies/$id" params={{ id: c.company_id }} className="hover:underline">{c.company_name ?? "—"}</Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-semibold">{c.score}</td>
                        <td className="px-4 py-3 text-center">{tierBadge(c.tier)}</td>
                        <td className="px-4 py-3 text-right">{c.pipelineValue > 0 ? BRL(c.pipelineValue) : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.signals.slice(0, 3).map((s, i) => (
                              <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.reason}</td>
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
