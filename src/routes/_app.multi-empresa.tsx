import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getMultiOrgComparison } from "@/lib/multi-org-compare.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import { Building2, TrendingUp, Users, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_app/multi-empresa")({ component: MultiEmpresaPage });

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function MultiEmpresaPage() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(getMultiOrgComparison);
  const [days, setDays] = useState("90");

  const q = useQuery({
    queryKey: ["multi-empresa", orgId, days],
    enabled: !!orgId,
    queryFn: () =>
      run({ data: { root_org_id: orgId!, days: Number(days) } }),
  });

  const orgsById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of q.data?.orgs ?? []) m.set(o.id, o.name);
    return m;
  }, [q.data]);

  const chartOrgs = useMemo(
    () => (q.data?.leaderboard ?? []).slice(0, 6).map((r) => r.org_id),
    [q.data],
  );
  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comparativo multiempresa"
        subtitle="Compare receita, ticket médio, conversão e pipeline entre empresas e filiais da hierarquia."
        icon={Building2}
        action={
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
              <SelectItem value="180">180 dias</SelectItem>
              <SelectItem value="365">365 dias</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {q.isLoading && <Skeleton className="h-64" />}
      {q.data && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KPI icon={DollarSign} label="Receita total" value={fmt(q.data.totals?.revenue ?? 0)} />
            <KPI icon={TrendingUp} label="Pedidos" value={(q.data.totals?.orders ?? 0).toLocaleString("pt-BR")} />
            <KPI icon={Users} label="Won (CRM)" value={fmt(q.data.totals?.won_value ?? 0)} />
            <KPI icon={Building2} label="Pipeline aberto" value={fmt(q.data.totals?.pipeline_value ?? 0)} />
          </div>

          <Card>
            <CardHeader><CardTitle>Receita por empresa — série temporal</CardTitle></CardHeader>
            <CardContent style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={q.data.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend formatter={(v) => orgsById.get(String(v)) ?? String(v)} />
                  {chartOrgs.map((id, i) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      stroke={colors[i % colors.length]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ranking comparativo</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Ticket médio</TableHead>
                    <TableHead className="text-right">Clientes ativos</TableHead>
                    <TableHead className="text-right">Won</TableHead>
                    <TableHead className="text-right">Pipeline</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.leaderboard.map((r) => (
                    <TableRow key={r.org_id} className="cursor-pointer hover:bg-muted/40">
                      <TableCell className="font-medium">
                        <Link to="/multi-empresa/$orgId" params={{ orgId: r.org_id }} className="hover:underline">
                          {r.org_name}
                        </Link>
                      </TableCell>
                      <TableCell><Badge variant="outline">{r.org_type}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(r.revenue)}</TableCell>
                      <TableCell className="text-right">{r.orders}</TableCell>
                      <TableCell className="text-right">{fmt(r.avg_ticket)}</TableCell>
                      <TableCell className="text-right">{r.active_customers}</TableCell>
                      <TableCell className="text-right">{fmt(r.won_value)}</TableCell>
                      <TableCell className="text-right">{fmt(r.pipeline_value)}</TableCell>
                      <TableCell className="text-right">{r.conversion_pct}%</TableCell>
                    </TableRow>
                  ))}
                  {!q.data.leaderboard.length && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sem dados no período.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPI({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Icon className="h-4 w-4" />{label}</div>
        <div className="text-2xl font-semibold mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}
