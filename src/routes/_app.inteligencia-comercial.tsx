import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getCommercialIntel } from "@/lib/intel-comercial.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, MapPin, AlertTriangle, Sparkles, Megaphone, Users, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/_app/inteligencia-comercial")({
  component: IntelComercialPage,
});

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function IntelComercialPage() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(getCommercialIntel);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["intel-comercial", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId!, days: 90, limit: 10 } }),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Inteligência Comercial"
        subtitle="Respostas diretas às perguntas que movem a receita."
        action={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* 1. Quem vende mais */}
        <IntelCard
          icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
          title="Quem vende mais"
          subtitle="Top representantes nos últimos 90 dias"
          loading={isLoading}
        >
          {data?.topReps.length ? (
            <ol className="space-y-2 text-sm">
              {data.topReps.slice(0, 5).map((r, i) => (
                <li key={r.user_id} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{i + 1}</Badge>
                    <span className="truncate">{r.full_name}</span>
                  </span>
                  <span className="font-medium tabular-nums">{brl(r.revenue)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyMsg msg="Sem vendas sincronizadas no período." />
          )}
        </IntelCard>

        {/* 2. Quem vende menos */}
        <IntelCard
          icon={<TrendingDown className="h-5 w-5 text-amber-500" />}
          title="Quem vende menos"
          subtitle="Representantes ativos com menor receita"
          loading={isLoading}
        >
          {data?.bottomReps.length ? (
            <ol className="space-y-2 text-sm">
              {data.bottomReps.slice(0, 5).map((r) => (
                <li key={r.user_id} className="flex items-center justify-between">
                  <span className="truncate">{r.full_name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {brl(r.revenue)} <span className="text-xs">· {r.orders}p</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyMsg msg="Sem dados suficientes." />
          )}
        </IntelCard>

        {/* 3. Quem devo visitar */}
        <IntelCard
          icon={<Users className="h-5 w-5 text-blue-500" />}
          title="Quem devo visitar hoje"
          subtitle="Score = churn + recência + valor"
          loading={isLoading}
        >
          {data?.visitToday.length ? (
            <ul className="space-y-2 text-sm">
              {data.visitToday.slice(0, 5).map((c) => (
                <li key={c.erp_customer_id} className="flex items-center justify-between gap-2">
                  <Link
                    to="/companies/$id"
                    params={{ id: c.company_id ?? c.erp_customer_id }}
                    className="truncate hover:underline"
                  >
                    {c.display_name ?? "(sem nome)"}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {c.recency_days ?? "—"}d · {c.churn_probability != null ? pct(c.churn_probability) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyMsg msg="Sem clientes elegíveis." />
          )}
        </IntelCard>

        {/* 4. Potencial */}
        <IntelCard
          icon={<Sparkles className="h-5 w-5 text-purple-500" />}
          title="Clientes com potencial"
          subtitle="Recompra prevista (IA)"
          loading={isLoading}
        >
          {data?.highPotential.length ? (
            <ul className="space-y-2 text-sm">
              {data.highPotential.slice(0, 5).map((c) => (
                <li key={c.erp_customer_id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.display_name ?? c.erp_customer_id.slice(0, 8)}</span>
                  <span className="font-medium tabular-nums">
                    {c.expected_value ? brl(c.expected_value) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyMsg msg="Rode o batch de propensão para gerar previsões." />
          )}
        </IntelCard>

        {/* 5. Risco */}
        <IntelCard
          icon={<AlertTriangle className="h-5 w-5 text-rose-500" />}
          title="Clientes em risco"
          subtitle="Probabilidade de churn (IA)"
          loading={isLoading}
        >
          {data?.churnRisk.length ? (
            <ul className="space-y-2 text-sm">
              {data.churnRisk.slice(0, 5).map((c) => (
                <li key={c.erp_customer_id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.display_name ?? c.erp_customer_id.slice(0, 8)}</span>
                  <Badge
                    variant={c.risk_level === "high" ? "destructive" : "secondary"}
                    className="tabular-nums"
                  >
                    {pct(c.churn_probability)}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyMsg msg="Nenhuma predição de churn ainda." />
          )}
        </IntelCard>

        {/* 6. Regiões */}
        <IntelCard
          icon={<MapPin className="h-5 w-5 text-cyan-500" />}
          title="Regiões com oportunidade"
          subtitle="Receita por estado/cidade"
          loading={isLoading}
        >
          {data?.regionalOpps.length ? (
            <ul className="space-y-2 text-sm">
              {data.regionalOpps.slice(0, 5).map((r, i) => (
                <li key={`${r.state}-${r.city}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {r.city ?? "—"} <span className="text-muted-foreground">/ {r.state ?? "—"}</span>
                  </span>
                  <span className="font-medium tabular-nums">{brl(r.revenue)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyMsg msg="Sincronize histórico comercial para ver regiões." />
          )}
        </IntelCard>

        {/* 7. Campanhas */}
        <IntelCard
          icon={<Megaphone className="h-5 w-5 text-orange-500" />}
          title="Campanhas que funcionam"
          subtitle="Maior CTR no período"
          loading={isLoading}
        >
          {data?.topCampaigns.length ? (
            <ul className="space-y-2 text-sm">
              {data.topCampaigns.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    abr {pct(c.open_rate)} · clk {pct(c.click_rate)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyMsg msg="Nenhuma campanha enviada no período." />
          )}
        </IntelCard>
      </div>

      {data?.generated_at && (
        <p className="text-xs text-muted-foreground">
          Atualizado em {new Date(data.generated_at).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}

function IntelCard({
  icon, title, subtitle, loading, children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return <p className="text-sm text-muted-foreground">{msg}</p>;
}
