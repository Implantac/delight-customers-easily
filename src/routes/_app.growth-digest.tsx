import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Sparkles, TrendingUp, TrendingDown, Minus, ArrowRight,
  Trophy, AlertTriangle, Target, Calendar, RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCurrentOrg } from "@/lib/org";
import { getGrowthDigest, type GrowthDigest } from "@/lib/growth-digest.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/growth-digest")({
  head: () => ({
    meta: [
      { title: "Growth Digest — Relatório Executivo da Semana" },
      { name: "description", content: "Resumo semanal automático: score, vitórias, riscos e o foco recomendado para os próximos 7 dias." },
    ],
  }),
  component: GrowthDigestPage,
});

const TONE: Record<"positive" | "negative" | "neutral", string> = {
  positive: "border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  negative: "border-rose-500/40 bg-rose-500/5 text-rose-600 dark:text-rose-400",
  neutral: "border-muted bg-muted/40 text-muted-foreground",
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function GrowthDigestPage() {
  const { orgId } = useCurrentOrg();
  const [weeksBack, setWeeksBack] = useState(0);
  const digestFn = useServerFn(getGrowthDigest);

  const q = useQuery({
    queryKey: ["growth-digest", orgId, weeksBack],
    enabled: !!orgId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<GrowthDigest> =>
      digestFn({ data: { organization_id: orgId!, weeks_back: weeksBack } }),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <PageHeader
        title="Growth Digest"
        description="Relatório executivo automático da semana — score, vitórias, riscos e foco para os próximos 7 dias."
        icon={Sparkles}
      />

      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2, 4].map((w) => (
          <Button
            key={w}
            size="sm"
            variant={weeksBack === w ? "default" : "outline"}
            onClick={() => setWeeksBack(w)}
          >
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            {w === 0 ? "Esta semana" : w === 1 ? "Semana passada" : `${w} semanas atrás`}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", q.isFetching && "animate-spin")} />
          Recalcular
        </Button>
      </div>

      {q.isLoading || !q.data ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <DigestBody d={q.data} />
      )}
    </div>
  );
}

function DigestBody({ d }: { d: GrowthDigest }) {
  const scoreIcon = d.score.delta > 0 ? TrendingUp : d.score.delta < 0 ? TrendingDown : Minus;
  const ScoreIcon = scoreIcon;

  return (
    <div className="space-y-6">
      {/* Headline */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 via-transparent to-transparent">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[280px]">
            <Badge variant="outline" className="text-xs">{d.period.label}</Badge>
            <h2 className="text-2xl font-semibold tracking-tight">{d.headline}</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">{d.narrative}</p>
          </div>
          {d.score.current !== null && (
            <div className="text-right space-y-1">
              <div className="text-xs uppercase text-muted-foreground">USE Success</div>
              <div className="text-4xl font-bold">{d.score.current}</div>
              {d.score.previous !== null && (
                <div className={cn(
                  "flex items-center justify-end gap-1 text-sm font-medium",
                  d.score.delta > 0 ? "text-emerald-600" : d.score.delta < 0 ? "text-rose-600" : "text-muted-foreground",
                )}>
                  <ScoreIcon className="h-4 w-4" />
                  {d.score.delta > 0 ? "+" : ""}{d.score.delta} pts
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* KPIs da semana */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Receita fechada" value={fmtBRL(d.revenue.won)} sub={`${d.wins.count} negócio(s)`} tone="positive" />
        <KpiCard label="Perdas" value={fmtBRL(d.losses.total)} sub={`${d.losses.count} negócio(s)`} tone={d.losses.count > 0 ? "negative" : "neutral"} />
        <KpiCard label="Pipeline aberto" value={fmtBRL(d.revenue.open_pipeline)} sub="A converter" tone="neutral" />
        <KpiCard
          label="Variação vs semana ant."
          value={d.revenue.won_prev > 0 ? `${d.revenue.growth >= 0 ? "+" : ""}${Math.round(d.revenue.growth * 100)}%` : "—"}
          sub={fmtBRL(d.revenue.won_prev)}
          tone={d.revenue.growth >= 0 ? "positive" : "negative"}
        />
      </div>

      {/* Top wins */}
      {d.wins.top.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold">Maiores vitórias da semana</h3>
          </div>
          <div className="space-y-2">
            {d.wins.top.map((w, i) => (
              <div key={i} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0">
                <span className="text-sm truncate">{w.title}</span>
                <span className="text-sm font-semibold tabular-nums">{fmtBRL(w.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Highlights */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Destaques da semana
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {d.highlights.map((h, i) => (
            <div key={i} className={cn("rounded-xl border p-4 space-y-1", TONE[h.tone])}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">{h.title}</div>
                <div className="text-sm font-bold tabular-nums">{h.metric}</div>
              </div>
              <p className="text-xs text-muted-foreground">{h.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Foco da semana */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Foco da próxima semana
        </h3>
        <div className="space-y-3">
          {d.focus.map((f, i) => (
            <Card key={i} className="p-4 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                {f.priority}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="font-semibold">{f.title}</div>
                <p className="text-sm text-muted-foreground">{f.reason}</p>
                {f.impact_brl && f.impact_brl > 0 && (
                  <div className="text-xs text-emerald-600 font-medium">
                    Impacto estimado: {fmtBRL(f.impact_brl)}
                  </div>
                )}
              </div>
              {f.href && (
                <Button size="sm" variant="outline" asChild>
                  <a href={f.href}>Ir agora <ArrowRight className="ml-1 h-3.5 w-3.5" /></a>
                </Button>
              )}
            </Card>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-4">
        Gerado automaticamente em {new Date(d.computed_at).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "positive" | "negative" | "neutral" }) {
  return (
    <Card className="p-4 space-y-1">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={cn(
        "text-2xl font-bold tabular-nums",
        tone === "positive" && "text-emerald-600",
        tone === "negative" && "text-rose-600",
      )}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}
