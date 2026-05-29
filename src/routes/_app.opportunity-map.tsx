import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getOpportunityMap } from "@/lib/geo.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MapPin, Building2, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_app/opportunity-map")({ component: OpportunityMapPage });

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function OpportunityMapPage() {
  const { orgId } = useCurrentOrg();
  const fn = useServerFn(getOpportunityMap);
  const { data, isLoading } = useQuery({
    queryKey: ["opp-map", orgId],
    enabled: !!orgId,
    queryFn: () => fn({ data: { organization_id: orgId! } }),
  });

  if (isLoading || !data) {
    return <div className="p-4 md:p-8 space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>;
  }

  const { territories, industries, summary } = data;
  const maxOpen = Math.max(1, ...territories.map((t) => t.open_value));

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Mapa de Oportunidades"
        subtitle="Onde está concentrado seu pipeline. Cada célula é um território comercial (setor × porte)."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={Building2} label="Empresas" value={summary.total_companies} />
        <Kpi icon={MapPin} label="Territórios" value={summary.territories_count} />
        <Kpi icon={TrendingUp} label="Pipeline aberto" value={fmt(summary.total_open_value)} tone="primary" />
        <Kpi icon={TrendingUp} label="Ganho histórico" value={fmt(summary.total_won_value)} tone="emerald" />
      </div>

      {/* Heatmap por território */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Heatmap por território (top 24)</h3>
        {territories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cadastre empresas com setor e porte para visualizar o mapa.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {territories.slice(0, 24).map((t, i) => {
              const intensity = Math.max(0.08, t.open_value / maxOpen);
              return (
                <div
                  key={i}
                  className="rounded-md p-3 border bg-primary text-primary-foreground transition-opacity"
                  style={{ opacity: 0.25 + intensity * 0.75 }}
                >
                  <p className="text-xs opacity-80">{t.size}</p>
                  <p className="font-semibold text-sm truncate">{t.industry}</p>
                  <div className="mt-2 space-y-0.5 text-xs">
                    <p>{t.companies} empresas · {t.open_deals} deals</p>
                    <p className="font-semibold">{fmt(t.open_value)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Indústrias - barras */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Pipeline por setor</h3>
        {industries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <div className="space-y-2">
            {industries.slice(0, 10).map((ind, i) => {
              const max = Math.max(...industries.map((x) => x.open_value), 1);
              const w = (ind.open_value / max) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{ind.industry}</span>
                    <span className="text-muted-foreground">{fmt(ind.open_value)} · {ind.companies} empresas</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Top territórios detalhados */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Top territórios — empresas-alvo</h3>
        <div className="space-y-4">
          {territories.slice(0, 6).map((t, i) => (
            <div key={i} className="border-b last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-sm">{t.industry} <span className="text-muted-foreground font-normal">· {t.size}</span></p>
                  <p className="text-xs text-muted-foreground">{t.companies} empresas · {fmt(t.open_value)} em pipeline</p>
                </div>
                <Badge variant="outline">{fmt(t.won_value)} ganho</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {t.company_list.map((c) => (
                  <Link
                    key={c.id}
                    to="/companies/$id"
                    params={{ id: c.id }}
                    className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors"
                  >
                    {c.name} {c.open_value > 0 && <span className="text-muted-foreground">· {fmt(c.open_value)}</span>}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: any) {
  const tones: Record<string, string> = {
    primary: "text-primary", emerald: "text-emerald-500",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <p className={`mt-1 text-2xl font-bold ${tones[tone ?? ""] ?? "text-foreground"}`}>{value}</p>
    </Card>
  );
}
