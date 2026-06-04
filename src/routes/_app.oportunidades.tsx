import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import {
  getOpportunitiesCentral,
  TYPE_LABELS,
  TYPE_TONES,
  type OppType,
} from "@/lib/opportunities-central.functions";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, ArrowRight, Flame, TrendingUp, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_app/oportunidades")({ component: OportunidadesPage });

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const TONE_CLASS: Record<string, string> = {
  primary: "bg-primary/15 text-primary border-primary/30",
  emerald: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  violet: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  destructive: "bg-destructive/15 text-destructive border-destructive/30",
};

function OportunidadesPage() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(getOpportunitiesCentral);
  const [filter, setFilter] = useState<OppType | "all">("all");
  const [sort, setSort] = useState<"score" | "value">("score");

  const { data, isLoading } = useQuery({
    queryKey: ["opp-central", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const base = filter === "all"
      ? data.opportunities
      : data.opportunities.filter((o) => o.type === filter);
    const sorted = [...base].sort((a, b) =>
      sort === "value" ? b.value - a.value : b.score - a.score,
    );
    return sorted;
  }, [data, filter, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motor de Oportunidades"
        subtitle="Ranking automático de onde existe dinheiro disponível hoje."
        icon={Target}
      />

      <NextActionBlock surface="opportunities" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Oportunidades" value={data?.summary.total ?? 0} icon={Target} loading={isLoading} />
        <Kpi label="Valor potencial" value={data ? fmt(data.summary.total_value) : "—"} icon={TrendingUp} tone="primary" loading={isLoading} />
        <Kpi label="Recuperação" value={data?.summary.by_type.recovery ?? 0} icon={RotateCcw} tone="warn" loading={isLoading} />
        <Kpi label="Leads quentes" value={data?.summary.by_type.hot_lead ?? 0} icon={Flame} tone="ok" loading={isLoading} />
      </div>

      <Card className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as OppType | "all")} className="flex-1">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="all" className="gap-2">
              Todas <span className="text-[10px] text-muted-foreground">{data?.summary.total ?? 0}</span>
            </TabsTrigger>
            {(Object.keys(TYPE_LABELS) as OppType[]).map((t) => (
              <TabsTrigger key={t} value={t} className="gap-2">
                {TYPE_LABELS[t]}
                <span className="text-[10px] text-muted-foreground">{data?.summary.by_type[t] ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <span className="pr-1">Ordenar:</span>
          <Button
            size="sm"
            variant={sort === "score" ? "secondary" : "ghost"}
            className="h-7 px-2"
            onClick={() => setSort("score")}
          >
            Prioridade IA
          </Button>
          <Button
            size="sm"
            variant={sort === "value" ? "secondary" : "ghost"}
            className="h-7 px-2"
            onClick={() => setSort("value")}
          >
            Valor
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nenhuma oportunidade nessa lente. Tente outra aba.
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.slice(0, 60).map((o) => (
            <Card key={o.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 h-10 w-10 rounded-md border flex items-center justify-center font-mono text-xs ${TONE_CLASS[TYPE_TONES[o.type]]}`}>
                  {o.score}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{o.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.subtitle}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${TONE_CLASS[TYPE_TONES[o.type]]}`}>
                      {TYPE_LABELS[o.type]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{o.reason}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-mono">
                      {o.value > 0 ? fmt(o.value) : <span className="text-muted-foreground">—</span>}
                    </span>
                    <Button asChild size="sm" variant="ghost" className="gap-1">
                      <Link to={o.action_href as any}>
                        {o.action_label} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label, value, icon: Icon, tone, loading,
}: {
  label: string; value: string | number; icon: typeof Target;
  tone?: "ok" | "warn" | "danger" | "primary"; loading?: boolean;
}) {
  const color =
    tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-amber-600"
    : tone === "ok" ? "text-emerald-600"
    : tone === "primary" ? "text-primary"
    : "text-foreground";
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
