import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { Download, TrendingUp, Target, Trophy, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, FunnelChart, Funnel, LabelList } from "recharts";
import { RequireManager } from "@/components/require-manager";

export const Route = createFileRoute("/_app/reports")({
  component: () => <RequireManager><ReportsPage /></RequireManager>,
});

const STAGES = [
  { id: "lead", label: "Lead", color: "var(--chart-1)" },
  { id: "qualified", label: "Qualificado", color: "var(--chart-2)" },
  { id: "proposal", label: "Proposta", color: "var(--chart-3)" },
  { id: "negotiation", label: "Negociação", color: "var(--chart-4)" },
  { id: "won", label: "Ganho", color: "var(--chart-5)" },
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
      <PageHeader
        tone="info"
        title="Relatórios Comerciais"
        subtitle="Funil, forecast 90 dias e ranking de receita — o pulso do time de vendas."
        icon={TrendingUp}
        action={
          <div className="flex gap-2">
            <Button asChild variant="default"><Link to="/reports/weekly"><FileText className="h-4 w-4 mr-2" />Executivo PDF</Link></Button>
            <Button onClick={exportCSV} variant="outline"><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Forecast 90d", value: fmt(stats.forecast), icon: Target, hint: null as string | null },
          { label: "Receita ganha", value: fmt(stats.wonValue), icon: TrendingUp, hint: `${stats.wonCount} oportunidades` },
          { label: "Taxa de vitória", value: `${stats.winRate.toFixed(1)}%`, icon: Trophy, hint: null },
        ].map((s, i) => (
          <Card
            key={s.label}
            className="relative overflow-hidden p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[var(--gradient-subtle)] opacity-0 transition-opacity duration-200 hover:opacity-100" />
            <div className="relative flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/60"><s.icon className="h-4 w-4 text-muted-foreground" /></div>
            </div>
            <p className="relative text-2xl font-bold mt-2 tracking-tight">{s.value}</p>
            {s.hint && <p className="relative text-xs text-muted-foreground">{s.hint}</p>}
          </Card>
        ))}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm font-medium mb-4">Funil de conversão</p>
          <div className="h-72">
            <ResponsiveContainer>
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={stats.funnel} isAnimationActive>
                  <LabelList position="right" fill="var(--foreground)" dataKey="name" />
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
                  <Bar dataKey="won" fill="var(--chart-2)" radius={[0, 4, 4, 0]}>
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
