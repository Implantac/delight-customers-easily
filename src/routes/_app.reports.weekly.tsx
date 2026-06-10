import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/lib/org";
import { listRecommendations } from "@/lib/recommendations.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/reports/weekly")({ component: WeeklyExec });

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const STAGE_LABEL: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualificado",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

function WeeklyExec() {
  const { orgId, org } = useCurrentOrg();
  const since = useMemo(() => new Date(Date.now() - 7 * 86400000).toISOString(), []);
  const listRecs = useServerFn(listRecommendations);

  const deals = useQuery({
    queryKey: ["weekly-deals", orgId],
    enabled: !!orgId,
    queryFn: async () =>
      (
        await supabase
          .from("deals")
          .select("id,title,value,stage,updated_at,created_at,expected_close")
          .eq("organization_id", orgId!)
      ).data ?? [],
  });

  const acts = useQuery({
    queryKey: ["weekly-acts", orgId, since],
    enabled: !!orgId,
    queryFn: async () =>
      (
        await supabase
          .from("activities")
          .select("type,completed,created_at,due_date")
          .eq("organization_id", orgId!)
          .gte("created_at", since)
      ).data ?? [],
  });

  const recs = useQuery({
    queryKey: ["weekly-recs", orgId],
    enabled: !!orgId,
    queryFn: () => listRecs({ data: { organization_id: orgId!, limit: 10 } }),
  });

  useEffect(() => {
    document.title = "Relatório Executivo Semanal";
  }, []);

  const totals = useMemo(() => {
    const d = deals.data ?? [];
    const open = d.filter((x) => x.stage !== "won" && x.stage !== "lost");
    const wonWeek = d.filter(
      (x) => x.stage === "won" && new Date(x.updated_at).getTime() >= Date.now() - 7 * 86400000
    );
    const lostWeek = d.filter(
      (x) => x.stage === "lost" && new Date(x.updated_at).getTime() >= Date.now() - 7 * 86400000
    );
    const newDeals = d.filter(
      (x) => new Date(x.created_at).getTime() >= Date.now() - 7 * 86400000
    );
    return {
      pipeline: open.reduce((s, x) => s + Number(x.value ?? 0), 0),
      pipelineCount: open.length,
      wonWeek: wonWeek.reduce((s, x) => s + Number(x.value ?? 0), 0),
      wonCount: wonWeek.length,
      lostWeek: lostWeek.reduce((s, x) => s + Number(x.value ?? 0), 0),
      lostCount: lostWeek.length,
      newCount: newDeals.length,
      newValue: newDeals.reduce((s, x) => s + Number(x.value ?? 0), 0),
    };
  }, [deals.data]);

  const stageBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const s of STAGES) map.set(s, { count: 0, value: 0 });
    for (const d of deals.data ?? []) {
      const cur = map.get(d.stage) ?? { count: 0, value: 0 };
      cur.count++;
      cur.value += Number(d.value ?? 0);
      map.set(d.stage, cur);
    }
    return [...map.entries()];
  }, [deals.data]);

  const actStats = useMemo(() => {
    const a = acts.data ?? [];
    const completed = a.filter((x) => x.completed).length;
    const overdue = a.filter(
      (x) => !x.completed && x.due_date && new Date(x.due_date).getTime() < Date.now()
    ).length;
    return { total: a.length, completed, overdue };
  }, [acts.data]);

  if (deals.isLoading) return <Skeleton className="h-96 m-6" />;

  const now = new Date();
  const periodLabel = `Semana de ${new Date(Date.now() - 7 * 86400000).toLocaleDateString("pt-BR")} a ${now.toLocaleDateString("pt-BR")}`;

  return (
    <div className="bg-white text-black min-h-screen">
      {/* Controles — somem na impressão */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-2 shadow-sm">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reports"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <div className="flex-1" />
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />Exportar PDF / Imprimir
        </Button>
      </div>

      <div className="max-w-4xl mx-auto p-8 print:p-0 space-y-8 text-[13px]">
        {/* Cabeçalho */}
        <header className="border-b pb-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Relatório Executivo Semanal</h1>
              <p className="text-gray-600 mt-1">{org?.name ?? "Organização"} · {periodLabel}</p>
            </div>
            <div className="text-right text-xs text-gray-500">
              Gerado em<br />
              {now.toLocaleString("pt-BR")}
            </div>
          </div>
        </header>

        {/* KPIs */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Indicadores da semana</h2>
          <div className="grid grid-cols-4 gap-3">
            <KPI label="Pipeline aberto" value={fmtBRL(totals.pipeline)} sub={`${totals.pipelineCount} negócios`} />
            <KPI label="Ganhos na semana" value={fmtBRL(totals.wonWeek)} sub={`${totals.wonCount} negócios`} tone="ok" />
            <KPI label="Perdas na semana" value={fmtBRL(totals.lostWeek)} sub={`${totals.lostCount} negócios`} tone="bad" />
            <KPI label="Novos negócios" value={String(totals.newCount)} sub={fmtBRL(totals.newValue)} />
          </div>
        </section>

        {/* Pipeline por estágio */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Pipeline por estágio</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-gray-500">
                <th className="py-2">Estágio</th>
                <th className="py-2 text-right">Negócios</th>
                <th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {stageBreakdown.map(([stage, v]) => (
                <tr key={stage} className="border-b last:border-0">
                  <td className="py-2">{STAGE_LABEL[stage] ?? stage}</td>
                  <td className="py-2 text-right">{v.count}</td>
                  <td className="py-2 text-right font-mono">{fmtBRL(v.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Atividades */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Produtividade (últimos 7 dias)</h2>
          <div className="grid grid-cols-3 gap-3">
            <KPI label="Atividades criadas" value={String(actStats.total)} />
            <KPI label="Concluídas" value={String(actStats.completed)} tone="ok" />
            <KPI label="Atrasadas" value={String(actStats.overdue)} tone={actStats.overdue > 0 ? "bad" : undefined} />
          </div>
        </section>

        {/* Próximas ações */}
        <section className="break-inside-avoid">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Top ações recomendadas</h2>
          {(recs.data?.items ?? []).length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma ação pendente.</p>
          ) : (
            <ol className="space-y-2 list-decimal pl-5">
              {(recs.data?.items ?? []).slice(0, 10).map((r: any) => (
                <li key={r.id} className="text-sm">
                  <span className="font-medium">{r.title}</span>
                  {r.impact_brl ? <span className="text-gray-600"> · {fmtBRL(Number(r.impact_brl))}</span> : null}
                  {r.reason ? <div className="text-xs text-gray-600 mt-0.5">{r.reason}</div> : null}
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="border-t pt-4 text-xs text-gray-500 text-center">
          USE PATRIUM · Relatório confidencial gerado automaticamente
        </footer>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 18mm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-gray-900";
  return (
    <div className="border rounded-md p-3">
      <div className="text-[11px] uppercase text-gray-500 tracking-wide">{label}</div>
      <div className={`text-lg font-bold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}
