import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers } from "lucide-react";
import { getCohorts } from "@/lib/cohorts.functions";

export const Route = createFileRoute("/_app/cohorts")({ component: CohortsPage });

const BRL = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function color(pct: number) {
  // pct 0-100 — blue ramp
  const a = Math.min(1, Math.max(0, pct / 100));
  return `rgba(59, 130, 246, ${0.08 + a * 0.85})`;
}

function CohortsPage() {
  const { orgId } = useCurrentOrg();
  const [months, setMonths] = useState(12);
  const [view, setView] = useState<"retention" | "revenue">("retention");
  const call = useServerFn(getCohorts);

  const { data, isLoading } = useQuery({
    queryKey: ["cohorts", orgId, months],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId!, months } }),
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        icon={Layers}
        title="Análise de Cohort"
        subtitle="Clientes agrupados pelo mês da primeira compra e quanto retornaram mês a mês."
        action={
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList>
                <TabsTrigger value="retention">Retenção</TabsTrigger>
                <TabsTrigger value="revenue">Receita</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 meses</SelectItem>
                <SelectItem value="12">12 meses</SelectItem>
                <SelectItem value="18">18 meses</SelectItem>
                <SelectItem value="24">24 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : data.rows.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Ainda não há negócios ganhos suficientes para gerar cohorts.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-4">
          <table className="w-full border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-2 py-1 text-left font-medium text-muted-foreground">Cohort</th>
                <th className="bg-card px-2 py-1 text-right font-medium text-muted-foreground">Clientes</th>
                {data.offsets.map((o) => (
                  <th key={o} className="px-2 py-1 text-center font-medium text-muted-foreground">M{o}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.cohort}>
                  <td className="sticky left-0 z-10 bg-card px-2 py-1 font-medium">{r.cohort}</td>
                  <td className="px-2 py-1 text-right text-muted-foreground">{r.size}</td>
                  {data.offsets.map((o) => {
                    const cell = r.cells[o];
                    if (!cell) {
                      return <td key={o} className="rounded px-2 py-1 text-center text-muted-foreground/40">—</td>;
                    }
                    if (view === "retention") {
                      const pct = (cell.retained / r.size) * 100;
                      return (
                        <td key={o} className="rounded px-2 py-1 text-center font-medium"
                          style={{ backgroundColor: color(pct), color: pct > 50 ? "white" : undefined }}>
                          {pct.toFixed(0)}%
                        </td>
                      );
                    }
                    const pct = Math.min(100, (cell.revenue / Math.max(1, r.totalRevenue)) * 100);
                    return (
                      <td key={o} className="rounded px-2 py-1 text-center font-medium"
                        style={{ backgroundColor: color(pct), color: pct > 50 ? "white" : undefined }}>
                        {BRL(cell.revenue)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span>Menos</span>
            {[10, 30, 50, 70, 90].map((p) => (
              <div key={p} className="h-3 w-8 rounded" style={{ backgroundColor: color(p) }} />
            ))}
            <span>Mais</span>
            <span className="ml-auto">{data.totalCompanies} clientes analisados</span>
          </div>
        </Card>
      )}
    </div>
  );
}
