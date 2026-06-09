import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getMultiOrgComparison } from "@/lib/multi-org-compare.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import { Building2, TrendingUp, Users, DollarSign, ChevronRight, LayoutGrid, Network } from "lucide-react";


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

  const [viewMode, setViewGrid] = useState<"ranking" | "hierarchy">("ranking");

  return (
    <div className="space-y-8 p-4 md:p-8">
      <PageHeader
        title="Gestão de Empresas & Filiais"
        subtitle="Visão consolidada e individual de todo o grupo empresarial. Gerencie múltiplos CNPJs e unidades."
        icon={Building2}
        action={
          <div className="flex gap-2">
             <div className="flex bg-muted p-1 rounded-lg border border-border/40">
                <button 
                  onClick={() => setViewGrid("ranking")}
                  className={cn("px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all", viewMode === "ranking" ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
                >
                  Ranking
                </button>
                <button 
                  onClick={() => setViewGrid("hierarchy")}
                  className={cn("px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all", viewMode === "hierarchy" ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
                >
                  Hierarquia
                </button>
             </div>

            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32 rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
                <SelectItem value="180">180 dias</SelectItem>
                <SelectItem value="365">365 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {q.isLoading && <Skeleton className="h-64 rounded-3xl" />}
      
      {q.data && (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-4">
            <KPI icon={DollarSign} label="Receita Grupo" value={fmt(q.data.totals?.revenue ?? 0)} />
            <KPI icon={TrendingUp} label="Pedidos Totais" value={(q.data.totals?.orders ?? 0).toLocaleString("pt-BR")} />
            <KPI icon={Users} label="Won Consolidado" value={fmt(q.data.totals?.won_value ?? 0)} />
            <KPI icon={Building2} label="Pipeline Aberto" value={fmt(q.data.totals?.pipeline_value ?? 0)} />
          </div>

          <Card className="p-6 border-primary/10 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                <Network className="h-32 w-32 text-primary" />
            </div>
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-xl font-display font-bold">Desempenho Comercial por Unidade</CardTitle>
                <CardDescription>Receita por empresa ao longo do período selecionado.</CardDescription>
            </CardHeader>
            <CardContent className="px-0" style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={q.data.series}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={v => `R$ ${v/1000}k`} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                  <Legend iconType="circle" formatter={(v) => orgsById.get(String(v)) ?? String(v)} />
                  {chartOrgs.map((id, i) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      stroke={colors[i % colors.length]}
                      dot={false}
                      strokeWidth={3}
                      animationDuration={1500}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {viewMode === "ranking" ? (
            <Card className="border-border/40 overflow-hidden">
                <div className="p-6 border-b border-border/40 bg-muted/20">
                    <h3 className="font-bold flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-primary" /> Ranking de Performance
                    </h3>
                </div>
                <Table>
                    <TableHeader className="bg-muted/30">
                    <TableRow>
                        <TableHead className="font-bold text-[10px] uppercase">Empresa</TableHead>
                        <TableHead className="font-bold text-[10px] uppercase">Tipo</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase">Receita</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase">Pedidos</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase">Tkt Médio</TableHead>
                        <TableHead className="text-right font-bold text-[10px] uppercase font-bold text-primary">Conversão</TableHead>
                        <TableHead className="text-right"></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {q.data.leaderboard.map((r) => (
                        <TableRow key={r.org_id} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="font-semibold">{r.org_name}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[9px] uppercase">{r.org_type}</Badge></TableCell>
                        <TableCell className="text-right font-mono font-bold">{fmt(r.revenue)}</TableCell>
                        <TableCell className="text-right">{r.orders}</TableCell>
                        <TableCell className="text-right">{fmt(r.avg_ticket)}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: `${r.conversion_pct}%` }} />
                                </div>
                                <span className="font-bold text-primary">{r.conversion_pct}%</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            <Button asChild size="sm" variant="ghost">
                                <Link to="/multi-empresa/$orgId" params={{ orgId: r.org_id }}>
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </Card>
          ) : (
            <div className="space-y-4">
                <h3 className="font-bold text-lg">Visualização da Hierarquia do Grupo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Exibindo a árvore de forma simplificada */}
                    {q.data.orgs.filter(o => !o.parent_org_id).map(parent => (
                        <div key={parent.id} className="space-y-3">
                             <Card className="p-4 border-primary/20 bg-primary/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-primary text-primary-foreground"><Building2 className="h-5 w-5" /></div>
                                    <div>
                                        <div className="font-bold text-primary">{parent.name}</div>
                                        <div className="text-[10px] uppercase font-bold text-primary/60">Holding / Matriz</div>
                                    </div>
                                </div>
                             </Card>
                             <div className="pl-6 space-y-2 relative">
                                <div className="absolute left-3 top-0 bottom-0 w-px bg-primary/20" />
                                {q.data.orgs.filter(o => o.parent_org_id === parent.id).map(child => (
                                    <Card key={child.id} className="p-3 border-border/40 hover:border-primary/30 transition-all cursor-pointer relative group">
                                        <div className="absolute -left-3 top-1/2 w-3 h-px bg-primary/20" />
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="text-xl">{child.org_type === 'loja' ? '🏪' : '🏭'}</div>
                                                <div>
                                                    <div className="text-sm font-bold group-hover:text-primary transition-colors">{child.name}</div>
                                                    <div className="text-[10px] text-muted-foreground uppercase">{child.org_type}</div>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                        </div>
                                    </Card>
                                ))}
                             </div>
                        </div>
                    ))}
                </div>
            </div>
          )}
        </div>
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
