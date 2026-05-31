import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Crown, Heart, Sparkles, UserPlus, AlertOctagon, Moon, Skull } from "lucide-react";
import { getSegments, type Segment } from "@/lib/segments.functions";

export const Route = createFileRoute("/_app/segments")({ component: SegmentsPage });

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const SEG_META: Record<Segment, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  champions: { icon: Crown, tone: "text-amber-500 bg-amber-500/10" },
  loyal: { icon: Heart, tone: "text-rose-500 bg-rose-500/10" },
  potential: { icon: Sparkles, tone: "text-violet-500 bg-violet-500/10" },
  new: { icon: UserPlus, tone: "text-emerald-500 bg-emerald-500/10" },
  at_risk: { icon: AlertOctagon, tone: "text-red-500 bg-red-500/10" },
  hibernating: { icon: Moon, tone: "text-blue-500 bg-blue-500/10" },
  lost: { icon: Skull, tone: "text-muted-foreground bg-muted" },
};

function SegmentsPage() {
  const { orgId } = useCurrentOrg();
  const [filter, setFilter] = useState<Segment | "all">("all");
  const call = useServerFn(getSegments);
  const { data, isLoading } = useQuery({
    queryKey: ["segments", orgId],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });

  const rows = (data?.rows ?? []).filter((r) => filter === "all" || r.segment === filter);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={Sparkles}
        title="Segmentação RFM"
        subtitle="Clientes agrupados por Recência, Frequência e Valor. Cada segmento sugere uma ação concreta."
      />

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : data.total === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Ainda não há negócios ganhos suficientes para segmentar. Volte após fechar algumas vendas.
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {data.summary.map((s) => {
              const meta = SEG_META[s.segment];
              const Icon = meta.icon;
              return (
                <Card
                  key={s.segment}
                  className={`cursor-pointer p-4 transition ${filter === s.segment ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setFilter(filter === s.segment ? "all" : s.segment)}
                >
                  <div className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${meta.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="mt-1 text-2xl font-semibold">{s.count}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{BRL(s.revenue)}</div>
                </Card>
              );
            })}
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b p-4">
              <div className="text-sm font-medium">
                {rows.length} cliente{rows.length !== 1 ? "s" : ""}{filter !== "all" ? ` · ${filter}` : ""}
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Segment | "all")}>
                <TabsList>
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="champions">Campeões</TabsTrigger>
                  <TabsTrigger value="at_risk">Em risco</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead className="text-right">R</TableHead>
                  <TableHead className="text-right">F</TableHead>
                  <TableHead className="text-right">M</TableHead>
                  <TableHead className="text-right">Última compra</TableHead>
                  <TableHead className="text-right">Receita total</TableHead>
                  <TableHead>Próxima ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((r) => {
                  const meta = SEG_META[r.segment];
                  const Icon = meta.icon;
                  return (
                    <TableRow key={r.company_id}>
                      <TableCell>
                        <Link to="/companies/$id" params={{ id: r.company_id }} className="font-medium hover:underline">
                          {r.name}
                        </Link>
                        {r.industry && <div className="text-xs text-muted-foreground">{r.industry}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Icon className={`h-3 w-3 ${meta.tone.split(" ")[0]}`} />
                          {r.segment}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.rScore}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.fScore}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.mScore}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {r.recencyDays}d atrás
                      </TableCell>
                      <TableCell className="text-right font-medium">{BRL(r.monetary)}</TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">{r.action}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
