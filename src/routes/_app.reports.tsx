import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Download, TrendingUp, Target, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, FunnelChart, Funnel, LabelList } from "recharts";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

const STAGES = [
  { id: "lead", label: "Lead", color: "hsl(var(--chart-1))" },
  { id: "qualified", label: "Qualificado", color: "hsl(var(--chart-2))" },
  { id: "proposal", label: "Proposta", color: "hsl(var(--chart-3))" },
  { id: "negotiation", label: "Negociação", color: "hsl(var(--chart-4))" },
  { id: "won", label: "Ganho", color: "hsl(var(--chart-5))" },
];

function ReportsPage() {
  const { data: deals, isLoading } = useQuery({
    queryKey: ["reports-deals"],
    queryFn: async () => (await supabase.from("deals").select("id, title, value, stage, user_id, expected_close, created_at")).data ?? [],
  });

  const { data: members } = useQuery({
    queryKey: ["reports-members"],
    queryFn: async () => {
      const { data } = await supabase.from("memberships").select("user_id");
      const ids = [...new Set((data ?? []).map((m: any) => m.user_id))];
      if (!ids.length) return [] as { id: string; full_name: string }[];
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return (profs ?? []) as any;
    },
  });

  const stats = useMemo(() => {
    const ds = deals ?? [];
    const byStage: Record<string, { count: number; value: number }> = {};
    STAGES.forEach((s) => (byStage[s.id] = { count: 0, value: 0 }));
    let lostCount = 0;
    ds.forEach((d: any) => {
      if (d.stage === "lost") { lostCount++; return; }
      if (byStage[d.stage]) {
        byStage[d.stage].count++;
        byStage[d.stage].value += Number(d.value || 0);
      }
    });
    const funnel = STAGES.map((s) => ({ name: s.label, value: byStage[s.id].count, fill: s.color }));
    const wonValue = byStage.won.value;
    const wonCount = byStage.won.count;
    const totalClosed = wonCount + lostCount;
    const winRate = totalClosed > 0 ? (wonCount / totalClosed) * 100 : 0;

    // Forecast: open deals expected to close in next 90 days, weighted by stage probability
    const now = new Date();
    const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const weights: Record<string, number> = { lead: 0.1, qualified: 0.25, proposal: 0.5, negotiation: 0.75, won: 1, lost: 0 };
    let forecast = 0;
    ds.forEach((d: any) => {
      if (d.stage === "won" || d.stage === "lost") return;
      if (d.expected_close) {
        const ec = new Date(d.expected_close);
        if (ec >= now && ec <= horizon) forecast += Number(d.value || 0) * (weights[d.stage] ?? 0);
      }
    });

    // Performance per user
    const byUser: Record<string, { won: number; open: number; count: number }> = {};
    ds.forEach((d: any) => {
      if (!byUser[d.user_id]) byUser[d.user_id] = { won: 0, open: 0, count: 0 };
      byUser[d.user_id].count++;
      if (d.stage === "won") byUser[d.user_id].won += Number(d.value || 0);
      else if (d.stage !== "lost") byUser[d.user_id].open += Number(d.value || 0);
    });
    const perUser = Object.entries(byUser).map(([uid, v]) => ({
      uid,
      name: (members as any)?.find((m: any) => m.id === uid)?.full_name ?? "—",
      ...v,
    })).sort((a, b) => b.won - a.won);

    return { funnel, wonValue, wonCount, winRate, forecast, perUser };
  }, [deals, members]);

  const exportCSV = () => {
    const ds = deals ?? [];
    const rows = [["Título", "Valor", "Estágio", "Fechamento esperado", "Criado em"]];
    ds.forEach((d: any) => rows.push([
      d.title, String(d.value), d.stage, d.expected_close ?? "", d.created_at,
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `relatorio-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  if (isLoading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><div className="grid grid-cols-3 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div></div>;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Relatórios" subtitle="Funil, forecast e desempenho do time" action={
        <Button onClick={exportCSV} variant="outline"><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
      } />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Forecast 90d</p><Target className="h-4 w-4 text-muted-foreground" /></div>
          <p className="text-2xl font-bold mt-2">{fmt(stats.forecast)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Receita ganha</p><TrendingUp className="h-4 w-4 text-muted-foreground" /></div>
          <p className="text-2xl font-bold mt-2">{fmt(stats.wonValue)}</p>
          <p className="text-xs text-muted-foreground">{stats.wonCount} oportunidades</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Taxa de vitória</p><Trophy className="h-4 w-4 text-muted-foreground" /></div>
          <p className="text-2xl font-bold mt-2">{stats.winRate.toFixed(1)}%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm font-medium mb-4">Funil de conversão</p>
          <div className="h-72">
            <ResponsiveContainer>
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={stats.funnel} isAnimationActive>
                  <LabelList position="right" fill="hsl(var(--foreground))" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-medium mb-4">Receita ganha por vendedor</p>
          <div className="h-72">
            {stats.perUser.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            ) : (
              <ResponsiveContainer>
                <BarChart data={stats.perUser} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" tickFormatter={(v) => fmt(Number(v))} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar dataKey="won" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]}>
                    {stats.perUser.map((_, i) => <Cell key={i} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <p className="text-sm font-medium mb-3">Desempenho detalhado</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr><th className="text-left py-2">Vendedor</th><th className="text-right">Oportunidades</th><th className="text-right">Em aberto</th><th className="text-right">Ganho</th></tr>
            </thead>
            <tbody className="divide-y">
              {stats.perUser.map((u) => (
                <tr key={u.uid}>
                  <td className="py-2">{u.name}</td>
                  <td className="text-right">{u.count}</td>
                  <td className="text-right">{fmt(u.open)}</td>
                  <td className="text-right font-medium">{fmt(u.won)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
