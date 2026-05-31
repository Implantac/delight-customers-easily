import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, CheckCircle2, AlertTriangle, Users2 } from "lucide-react";
import { getProductivity } from "@/lib/productivity.functions";

export const Route = createFileRoute("/_app/productivity")({ component: ProductivityPage });

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const PCT = (n: number) => `${(n * 100).toFixed(0)}%`;

function HeatCell({ count, max }: { count: number; max: number }) {
  const intensity = max ? Math.min(1, count / max) : 0;
  const bg = intensity === 0
    ? "bg-muted/40"
    : intensity < 0.25 ? "bg-primary/20"
    : intensity < 0.5 ? "bg-primary/40"
    : intensity < 0.75 ? "bg-primary/65"
    : "bg-primary";
  return <div className={`h-3.5 w-3.5 rounded-sm ${bg}`} title={`${count} atividade(s)`} />;
}

function ProductivityPage() {
  const { orgId } = useCurrentOrg();
  const [days, setDays] = useState(30);
  const call = useServerFn(getProductivity);
  const { data, isLoading } = useQuery({
    queryKey: ["productivity", orgId, days],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId!, days } }),
    refetchOnWindowFocus: false,
  });

  const maxDaily = data ? Math.max(1, ...data.heatmap.map((h) => h.count)) : 1;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={Activity}
        title="Produtividade da equipe"
        subtitle="Quem está executando, quem precisa de ajuda — em um só olhar."
        action={
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <NextActionBlock surface="productivity" title="Destravar a equipe" showRegenerate />


      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users2 className="h-3.5 w-3.5" />Pessoas</div>
              <div className="mt-2 text-3xl font-semibold">{data.totals.members}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5" />Atividades</div>
              <div className="mt-2 text-3xl font-semibold">{data.totals.activities}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Concluídas</div>
              <div className="mt-2 text-3xl font-semibold">{data.totals.completed}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {data.totals.activities ? PCT(data.totals.completed / data.totals.activities) : "—"} taxa
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" />Atrasadas</div>
              <div className="mt-2 text-3xl font-semibold">{data.totals.overdue}</div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Atividade diária</p>
                <p className="text-xs text-muted-foreground">Volume por dia nos últimos {days} dias</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                Menos
                <div className="flex gap-1 mx-1">
                  <div className="h-3 w-3 rounded-sm bg-muted/40" />
                  <div className="h-3 w-3 rounded-sm bg-primary/20" />
                  <div className="h-3 w-3 rounded-sm bg-primary/40" />
                  <div className="h-3 w-3 rounded-sm bg-primary/65" />
                  <div className="h-3 w-3 rounded-sm bg-primary" />
                </div>
                Mais
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {data.heatmap.map((h) => <HeatCell key={h.date} count={h.count} max={maxDaily} />)}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Vendedor</th>
                  <th className="px-4 py-2 text-center">Score</th>
                  <th className="px-4 py-2 text-right">Atividades</th>
                  <th className="px-4 py-2">Conclusão</th>
                  <th className="px-4 py-2 text-right">Atrasadas</th>
                  <th className="px-4 py-2 text-right">Resp. (dias)</th>
                  <th className="px-4 py-2 text-right">Ganhos</th>
                  <th className="px-4 py-2 text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Sem dados.</td></tr>
                ) : data.rows.map((r) => (
                  <tr key={r.user_id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{r.role}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-semibold">{r.score}</td>
                    <td className="px-4 py-3 text-right">{r.activities}</td>
                    <td className="px-4 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <Progress value={r.completionRate * 100} className="h-2" />
                        <span className="text-xs text-muted-foreground w-9 text-right">{PCT(r.completionRate)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.overdue > 0 ? <Badge variant="destructive">{r.overdue}</Badge> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{r.avgRespDays > 0 ? r.avgRespDays.toFixed(1) : "—"}</td>
                    <td className="px-4 py-3 text-right text-emerald-500">{r.wonDeals}</td>
                    <td className="px-4 py-3 text-right font-medium">{BRL(r.wonValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
