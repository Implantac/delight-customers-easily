import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getCommercialIntel } from "@/lib/intel-comercial.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, MapPin, AlertTriangle, Sparkles, Megaphone, Users,
  RefreshCw, ArrowRight, Calendar, MessageCircle, Target,
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

  // "AI do Dia" — 3 ações destacadas, priorizadas por valor de receita em risco/potencial.
  const aiDoDia = (() => {
    const out: Array<{
      kind: "visit" | "recover" | "potential";
      title: string;
      reason: string;
      href: string;
      cta: { label: string; icon: typeof Calendar };
    }> = [];

    const visit = data?.visitToday?.[0];
    if (visit) {
      out.push({
        kind: "visit",
        title: visit.display_name ?? "Cliente prioritário",
        reason: `${visit.recency_days ?? "?"} dias sem contato${visit.churn_probability != null ? ` · risco ${pct(visit.churn_probability)}` : ""}. Visita pode reativar a relação.`,
        href: `/companies/${visit.company_id ?? visit.erp_customer_id}`,
        cta: { label: "Agendar visita", icon: Calendar },
      });
    }
    const risk = data?.churnRisk?.find((c) => c.risk_level === "high") ?? data?.churnRisk?.[0];
    if (risk) {
      out.push({
        kind: "recover",
        title: risk.display_name ?? "Cliente em risco",
        reason: `Probabilidade de churn ${pct(risk.churn_probability)}. Conversa direta no WhatsApp aumenta retenção em janelas curtas.`,
        href: `/companies/${(risk as any).company_id ?? risk.erp_customer_id}`,
        cta: { label: "Falar no WhatsApp", icon: MessageCircle },
      });
    }
    const pot = data?.highPotential?.[0];
    if (pot) {
      out.push({
        kind: "potential",
        title: pot.display_name ?? "Oportunidade quente",
        reason: `IA prevê recompra próxima${pot.expected_value ? ` de ${brl(pot.expected_value)}` : ""}. Crie a oportunidade no pipeline agora.`,
        href: `/companies/${(pot as any).company_id ?? pot.erp_customer_id}`,
        cta: { label: "Criar oportunidade", icon: Target },
      });
    }
    return out;
  })();

  return (
    <div className="page-container">
      <PageHeader
        tone="violet"
        title="Inteligência Comercial"
        subtitle="Respostas diretas às perguntas que movem a receita."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      {/* ============ AI do Dia — hero ============ */}
      <section className="surface-elevated relative mt-6 overflow-hidden p-5 md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[var(--gradient-mesh)] opacity-60" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)] ring-1 ring-white/10">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h2 className="font-display text-lg font-semibold tracking-tight">AI do Dia</h2>
            <span className="ml-auto text-[11px] uppercase tracking-wider text-muted-foreground">
              3 ações prioritárias para hoje
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {isLoading && (
              <>
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </>
            )}
            {!isLoading && aiDoDia.length === 0 && (
              <Card className="md:col-span-3 border-dashed">
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Sem ações prioritárias agora. Conecte o ERP ou rode o batch de propensão para ativar sugestões da IA.
                </CardContent>
              </Card>
            )}
            {aiDoDia.map((a, i) => {
              const Icon = a.cta.icon;
              return (
                <Card
                  key={i}
                  className="interactive-card group relative overflow-hidden border-primary/20 bg-card/90 backdrop-blur"
                >
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase tracking-wider"
                      >
                        {a.kind === "visit" ? "Visitar" : a.kind === "recover" ? "Recuperar" : "Potencial"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
                    </div>
                    <div>
                      <p className="line-clamp-1 font-semibold tracking-tight">{a.title}</p>
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{a.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button asChild size="sm" className="h-8 flex-1">
                        <Link to={a.href as any}>
                          <Icon className="mr-1 h-3.5 w-3.5" />
                          {a.cta.label}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                        <Link to={a.href as any} aria-label="Abrir cliente">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ Grade de insights — cada card tem CTA inline ============ */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* 1. Quem vende mais */}
        <IntelCard
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          title="Quem vende mais"
          subtitle="Top representantes nos últimos 90 dias"
          loading={isLoading}
          cta={{ label: "Ver representantes", href: "/representantes" }}
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
          icon={<TrendingDown className="h-4 w-4 text-amber-500" />}
          title="Quem vende menos"
          subtitle="Representantes ativos com menor receita"
          loading={isLoading}
          cta={{ label: "Atribuir coaching", href: "/coaching" }}
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
          icon={<Users className="h-4 w-4 text-blue-500" />}
          title="Quem devo visitar hoje"
          subtitle="Score = churn + recência + valor"
          loading={isLoading}
          cta={{ label: "Montar rota", href: "/geo-rota" }}
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
          icon={<Sparkles className="h-4 w-4 text-purple-500" />}
          title="Clientes com potencial"
          subtitle="Recompra prevista (IA)"
          loading={isLoading}
          cta={{ label: "Criar oportunidades", href: "/oportunidades" }}
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
          icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
          title="Clientes em risco"
          subtitle="Probabilidade de churn (IA)"
          loading={isLoading}
          cta={{ label: "Plano de retenção", href: "/retention" }}
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
          icon={<MapPin className="h-4 w-4 text-cyan-500" />}
          title="Regiões com oportunidade"
          subtitle="Receita por estado/cidade"
          loading={isLoading}
          cta={{ label: "Abrir geointeligência", href: "/geo" }}
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
          icon={<Megaphone className="h-4 w-4 text-orange-500" />}
          title="Campanhas que funcionam"
          subtitle="Maior CTR no período"
          loading={isLoading}
          cta={{ label: "Criar campanha", href: "/campaigns" }}
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
        <p className="mt-6 text-xs text-muted-foreground">
          Atualizado em {new Date(data.generated_at).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}

function IntelCard({
  icon, title, subtitle, loading, children, cta,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  loading: boolean;
  children: React.ReactNode;
  cta?: { label: string; href: string };
}) {
  return (
    <Card className="ring-brand-hover flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              {icon}{title}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex-1">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : (
            children
          )}
        </div>
        {cta && (
          <div className="mt-4 border-t border-border/60 pt-3">
            <Button asChild variant="ghost" size="sm" className="h-7 w-full justify-between px-2 text-xs">
              <Link to={cta.href as any}>
                {cta.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyMsg({ msg }: { msg: string }) {
  return <p className="text-sm text-muted-foreground">{msg}</p>;
}
