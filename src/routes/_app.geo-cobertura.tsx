import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getTerritorialCoverage, getProspectingInsights } from "@/lib/geo-prospect.functions";
import { listSilentCities } from "@/lib/geo-silent-cities.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Map, Sparkles, TrendingUp, Target, AlertTriangle, Clock, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/geo-cobertura")({ component: CoberturaPage });

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function CoberturaPage() {
  const { orgId } = useCurrentOrg();
  const fetchCov = useServerFn(getTerritorialCoverage);
  const fetchAI = useServerFn(getProspectingInsights);
  const fetchSilent = useServerFn(listSilentCities);

  const covQ = useQuery({
    queryKey: ["geo-coverage", orgId],
    enabled: !!orgId,
    queryFn: () => fetchCov({ data: { organization_id: orgId! } }),
  });

  const aiQ = useQuery({
    queryKey: ["geo-insights", orgId],
    enabled: !!orgId,
    queryFn: () => fetchAI({ data: { organization_id: orgId! } }),
    staleTime: 1000 * 60 * 30,
  });

  const silentQ = useQuery({
    queryKey: ["geo-silent-cities", orgId],
    enabled: !!orgId,
    queryFn: () => fetchSilent({ data: { organization_id: orgId!, limit: 20 } }),
    staleTime: 1000 * 60 * 10,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="IA de Cobertura Comercial"
        subtitle="Análise territorial de penetração de mercado e regiões subexploradas."
        icon={Map}
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KPI label="Cidades atendidas" value={covQ.data?.summary.cities ?? 0} icon={Map} loading={covQ.isLoading} />
        <KPI label="Clientes ativos" value={covQ.data?.summary.customers ?? 0} icon={Target} loading={covQ.isLoading} tone="ok" />
        <KPI label="Prospects" value={covQ.data?.summary.prospects ?? 0} icon={TrendingUp} loading={covQ.isLoading} />
      </div>

      {/* Cidades silenciosas */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" /> Cidades silenciosas
            </CardTitle>
            <CardDescription>
              Clientes sem atividade comercial recente — priorize reativação.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link to="/geo-rota">
              Montar rota <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {silentQ.isLoading ? (
            <div className="p-6"><Skeleton className="h-32 w-full" /></div>
          ) : !silentQ.data?.rows.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma cidade silenciosa — todas tiveram atividade nos últimos 60 dias 🎉
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Cidade</th>
                    <th className="text-left px-3 py-2">UF</th>
                    <th className="text-right px-3 py-2">Clientes</th>
                    <th className="text-right px-3 py-2">Sem visita 30d</th>
                    <th className="text-right px-3 py-2">60d</th>
                    <th className="text-right px-3 py-2">90d</th>
                    <th className="text-right px-3 py-2">Potencial perdido</th>
                  </tr>
                </thead>
                <tbody>
                  {silentQ.data.rows.map((r) => (
                    <tr key={`${r.city}-${r.state}`} className="border-t">
                      <td className="px-3 py-2 font-medium">{r.city}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.state ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{r.total}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">{r.silent_30}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/30">{r.silent_60}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">{r.silent_90}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{fmt(r.potential)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>



      {/* IA Insights */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Recomendações da IA
          </CardTitle>
          <CardDescription>Onde focar para crescer mais rápido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {aiQ.isLoading && <Skeleton className="h-32 w-full" />}
          {aiQ.data && (
            <>
              {aiQ.data.summary && (
                <p className="text-muted-foreground italic">"{aiQ.data.summary}"</p>
              )}
              {aiQ.data.regions?.length > 0 && (
                <InsightBlock title="Regiões com maior potencial" items={aiQ.data.regions} />
              )}
              {(aiQ.data as any).underexplored?.length > 0 && (
                <InsightBlock title="Cidades subexploradas" items={(aiQ.data as any).underexplored} tone="warn" />
              )}
              {(aiQ.data as any).industries?.length > 0 && (
                <InsightBlock title="Segmentos com oportunidade" items={(aiQ.data as any).industries} />
              )}
              {aiQ.data.actions?.length > 0 && (
                <InsightBlock title="Ações sugeridas" items={aiQ.data.actions} tone="action" />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Tabela de cobertura */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cobertura por cidade</CardTitle>
          <CardDescription>Ordenado por número total de empresas.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {covQ.isLoading ? (
            <div className="p-6"><Skeleton className="h-40 w-full" /></div>
          ) : !covQ.data?.rows.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma cidade cadastrada ainda. Importe ou cadastre empresas para ver a cobertura.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Cidade</th>
                    <th className="text-left px-3 py-2">UF</th>
                    <th className="text-right px-3 py-2">Clientes</th>
                    <th className="text-right px-3 py-2">Prospects</th>
                    <th className="text-right px-3 py-2">Cobertura</th>
                    <th className="text-right px-3 py-2">Pipeline aberto</th>
                  </tr>
                </thead>
                <tbody>
                  {covQ.data.rows.slice(0, 100).map((r) => (
                    <tr key={r.key} className="border-t">
                      <td className="px-3 py-2 font-medium">{r.city}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.state}</td>
                      <td className="px-3 py-2 text-right text-emerald-600 font-medium">{r.customers}</td>
                      <td className="px-3 py-2 text-right">{r.prospects}</td>
                      <td className="px-3 py-2 text-right">
                        <CoverageBar value={r.coverage} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{fmt(r.potential)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({
  label,
  value,
  icon: Icon,
  loading,
  tone,
}: {
  label: string;
  value: number | string;
  icon: typeof Map;
  loading?: boolean;
  tone?: "ok";
}) {
  const color = tone === "ok" ? "text-emerald-600" : "text-primary";
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <div className={`text-xl font-semibold mt-1 ${color}`}>{value}</div>}
    </Card>
  );
}

function CoverageBar({ value }: { value: number }) {
  const color =
    value >= 50 ? "bg-emerald-500" : value >= 20 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right">{value}%</span>
    </div>
  );
}

function InsightBlock({ title, items, tone }: { title: string; items: string[]; tone?: "warn" | "action" }) {
  const Icon = tone === "warn" ? AlertTriangle : tone === "action" ? Target : TrendingUp;
  const color =
    tone === "warn" ? "text-amber-600" : tone === "action" ? "text-primary" : "text-emerald-600";
  return (
    <div className="space-y-1.5">
      <div className={`text-xs font-medium flex items-center gap-1.5 ${color}`}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <ul className="space-y-1">
        {items.slice(0, 6).map((s, i) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <Badge variant="outline" className="shrink-0 mt-0.5 h-5 text-[10px]">{i + 1}</Badge>
            <span className="text-muted-foreground">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
