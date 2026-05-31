import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrgDrilldown } from "@/lib/org-drilldown.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ArrowLeft } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_app/multi-empresa/$orgId")({ component: DrilldownPage });

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function DrilldownPage() {
  const { orgId } = Route.useParams();
  const run = useServerFn(getOrgDrilldown);
  const q = useQuery({
    queryKey: ["org-drilldown", orgId],
    queryFn: () => run({ data: { organization_id: orgId, days: 90 } }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={q.data?.org?.name ?? "Drill-down de empresa"}
        subtitle="Pipeline, top representantes e top clientes da unidade selecionada (90 dias)."
        icon={Building2}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/multi-empresa"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
          </Button>
        }
      />

      {q.isLoading && <Skeleton className="h-64" />}
      {q.data && (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <Kpi label="Receita ERP" value={fmt(q.data.totals.revenue)} />
            <Kpi label="Won CRM" value={fmt(q.data.totals.won_value)} />
            <Kpi label="Pipeline" value={fmt(q.data.totals.pipeline_value)} />
            <Kpi label="Deals" value={String(q.data.totals.deals_count)} />
            <Kpi label="Pedidos" value={String(q.data.totals.orders_count)} />
          </div>

          <Card>
            <CardHeader><CardTitle>Pipeline por estágio</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {q.data.pipeline.map((p) => (
                  <Badge key={p.stage} variant="secondary" className="text-sm">
                    {p.stage}: {p.count} · {fmt(p.value)}
                  </Badge>
                ))}
                {!q.data.pipeline.length && (
                  <span className="text-sm text-muted-foreground">Sem deals no período.</span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Top representantes</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rep</TableHead>
                      <TableHead className="text-right">Won</TableHead>
                      <TableHead className="text-right">Pipeline</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.data.topReps.map((r) => (
                      <TableRow key={r.user_id}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="text-right">{fmt(r.won)}</TableCell>
                        <TableCell className="text-right">{fmt(r.pipeline)}</TableCell>
                      </TableRow>
                    ))}
                    {!q.data.topReps.length && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">—</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Top clientes (ERP)</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.data.topCustomers.map((c) => (
                      <TableRow key={c.erp_customer_id}>
                        <TableCell className="truncate max-w-[200px]">{c.name}</TableCell>
                        <TableCell>{c.state ?? "—"}</TableCell>
                        <TableCell className="text-right">{fmt(c.revenue)}</TableCell>
                        <TableCell className="text-right">{c.orders}</TableCell>
                      </TableRow>
                    ))}
                    {!q.data.topCustomers.length && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">—</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Atividades recentes</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {q.data.recentActivities.map((a) => (
                  <li key={a.id} className="flex justify-between border-b pb-1">
                    <span>
                      <Badge variant="outline" className="mr-2">{a.type}</Badge>
                      {a.subject ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
                {!q.data.recentActivities.length && (
                  <li className="text-muted-foreground">Sem atividades.</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="text-xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
