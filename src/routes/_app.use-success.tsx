import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { useState } from "react";
import {
  Rocket, TrendingUp, TrendingDown, Minus, Sparkles,
  AlertTriangle, CheckCircle2, Activity, ArrowUpRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useCurrentOrg } from "@/lib/org";
import { getUseSuccessReport, listUseSuccessHistory, listPillarHistory, type SuccessClass, type SuccessPillar } from "@/lib/use-success.functions";
import { ActionCard } from "@/components/action-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/use-success")({
  head: () => ({
    meta: [
      { title: "USE Success — Painel Executivo de Crescimento" },
      { name: "description", content: "Índice proprietário 0–100 que traduz sua operação comercial em sinais executivos de crescimento." },
    ],
  }),
  component: UseSuccessPage,
});

const CLASS_META: Record<SuccessClass, { label: string; tone: string; ring: string; bar: string }> = {
  excelente: { label: "Excelente", tone: "text-emerald-600", ring: "ring-emerald-500/40", bar: "bg-emerald-500" },
  boa:       { label: "Boa",        tone: "text-blue-600",    ring: "ring-blue-500/40",    bar: "bg-blue-500" },
  atencao:   { label: "Atenção",    tone: "text-amber-600",   ring: "ring-amber-500/40",   bar: "bg-amber-500" },
  critica:   { label: "Crítica",    tone: "text-rose-600",    ring: "ring-rose-500/40",    bar: "bg-rose-500" },
};

const pillarTone = (n: number) =>
  n >= 75 ? "text-emerald-600" : n >= 55 ? "text-blue-600" : n >= 40 ? "text-amber-600" : "text-rose-600";
const pillarBar = (n: number) =>
  n >= 75 ? "bg-emerald-500" : n >= 55 ? "bg-blue-500" : n >= 40 ? "bg-amber-500" : "bg-rose-500";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function UseSuccessPage() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(getUseSuccessReport);
  const runHist = useServerFn(listUseSuccessHistory);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["use-success", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const { data: hist } = useQuery({
    queryKey: ["use-success-history", orgId, data?.computed_at],
    enabled: !!orgId && !!data,
    queryFn: () => runHist({ data: { organization_id: orgId!, limit: 30 } }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-8 sm:px-4 md:px-6">
      <PageHeader
        title="USE Success"
        subtitle="Painel Executivo de Crescimento — índice 0-100 composto por 9 pilares."
        icon={Rocket}
        tone="violet"
        action={
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <Activity className="mr-1 h-3 w-3" />
            {isRefetching ? "Recalculando…" : "Recalcular"}
          </Button>
        }
      />

      {isLoading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="space-y-4 md:space-y-5">
          <HeroCard report={data} history={hist?.history ?? []} />
          <DeltaCard delta={data.delta} />
          <RevenueStrip report={data} />
          <PillarsGrid pillars={data.pillars} />
          <ActionsPanel actions={data.actions} />
        </div>
      )}
    </div>
  );
}

function DeltaCard({ delta }: { delta: Awaited<ReturnType<typeof getUseSuccessReport>>["delta"] }) {
  const Icon =
    delta.direction === "up" ? TrendingUp :
    delta.direction === "down" ? TrendingDown :
    delta.direction === "first" ? Sparkles : Minus;
  const tone =
    delta.direction === "up" ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" :
    delta.direction === "down" ? "text-rose-600 bg-rose-500/10 border-rose-500/30" :
    delta.direction === "first" ? "text-violet-600 bg-violet-500/10 border-violet-500/30" :
    "text-muted-foreground bg-muted/40 border-border/60";
  return (
    <Card className={cn("border p-3 sm:p-3.5", tone)}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
            O que mudou desde a última medição
          </p>
          <p className="mt-1 text-[13px] leading-snug">{delta.explanation}</p>
          {(delta.top_positive.length > 0 || delta.top_negative.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {delta.top_positive.map((p) => (
                <span key={p.key} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                  ↑ {p.label} +{p.delta}
                </span>
              ))}
              {delta.top_negative.map((p) => (
                <span key={p.key} className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
                  ↓ {p.label} {p.delta}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function HeroCard({
  report, history,
}: {
  report: Awaited<ReturnType<typeof getUseSuccessReport>>;
  history: { score: number; classification: string; computed_at: string }[];
}) {
  const meta = CLASS_META[report.classification];
  const TrendIcon =
    report.revenue.growth > 0.02 ? TrendingUp : report.revenue.growth < -0.02 ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-accent/10 p-4 sm:p-5 md:p-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex items-center gap-4">
            <div className={cn("relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-background ring-4", meta.ring)}>
              <span className={cn("font-display text-3xl font-bold tabular-nums", meta.tone)}>
                {report.score}
              </span>
              <span className="absolute -bottom-2 rounded-full border border-border bg-card px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {meta.label}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                USE Success Score
              </p>
              <h2 className="mt-1 font-display text-base font-semibold leading-tight tracking-tight sm:text-lg">
                {report.headline}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Recalculado em {new Date(report.computed_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </p>
              {history.length >= 2 && <Sparkline data={history.map((h) => h.score)} />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Fechado 30d" value={fmtBRL(report.revenue.won30)} tone={report.revenue.growth >= 0 ? "up" : "down"} icon={TrendIcon} />
            <MiniStat label="MoM" value={`${(report.revenue.growth * 100).toFixed(0)}%`} tone={report.revenue.growth >= 0 ? "up" : "down"} />
            <MiniStat label="Pipeline aberto" value={fmtBRL(report.revenue.open_pipeline)} />
            <MiniStat label="Receita em risco" value={fmtBRL(report.revenue.at_risk)} tone="warn" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 140, h = 28, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const span = Math.max(1, max - min);
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (data.length - 1);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = data[data.length - 1], first = data[0];
  const stroke = last >= first ? "stroke-emerald-500" : "stroke-rose-500";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="mt-2 opacity-80">
      <polyline points={pts} fill="none" strokeWidth="1.5" className={stroke} />
    </svg>
  );
}

function MiniStat({
  label, value, tone, icon: Icon,
}: {
  label: string; value: string; tone?: "up" | "down" | "warn"; icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneCls =
    tone === "up" ? "text-emerald-600" :
    tone === "down" ? "text-rose-600" :
    tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div className="rounded-md border border-border/60 bg-card/60 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">{label}</p>
      <p className={cn("mt-0.5 font-display text-sm font-semibold tabular-nums flex items-center gap-1", toneCls)}>
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {value}
      </p>
    </div>
  );
}

function RevenueStrip({ report }: { report: Awaited<ReturnType<typeof getUseSuccessReport>> }) {
  return (
    <Card className="border-border/60 p-3 sm:p-3.5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Composição do score
        </p>
      </div>
      <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-secondary">
        {report.pillars.map((p) => (
          <div
            key={p.key}
            className={cn("h-full transition-all", pillarBar(p.score))}
            style={{ width: `${p.weight * 100}%`, opacity: 0.35 + (p.score / 100) * 0.65 }}
            title={`${p.label}: ${p.score} · peso ${(p.weight * 100).toFixed(0)}%`}
          />
        ))}
      </div>
    </Card>
  );
}

function PillarsGrid({ pillars }: { pillars: SuccessPillar[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3">
      {pillars.map((p, i) => (
        <motion.div
          key={p.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 * i, duration: 0.25 }}
        >
          <Card className="h-full p-3.5 border-border/60 bg-card hover:border-primary/40 hover:bg-accent/20 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
                  {p.label}
                </p>
                <p className="mt-1 font-display text-sm font-semibold truncate">{p.value}</p>
              </div>
              <span className={cn("font-display text-xl font-bold tabular-nums leading-none", pillarTone(p.score))}>
                {p.score}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className={cn("h-full transition-all duration-700", pillarBar(p.score))} style={{ width: `${p.score}%` }} />
            </div>
            <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{p.detail}</p>
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              peso {(p.weight * 100).toFixed(0)}%
            </p>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function ActionsPanel({ actions }: { actions: Awaited<ReturnType<typeof getUseSuccessReport>>["actions"] }) {
  return (
    <Card className="border-border/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-md border border-border/60 bg-card">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold tracking-tight">Ações recomendadas pela IA</h3>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              Priorizadas pelos pilares mais fracos
            </p>
          </div>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Todos os pilares acima de 70 pontos — nenhuma ação urgente.</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {actions.map((a, i) => (
            <ActionCard
              key={i}
              title={a.title}
              reason={a.reason}
              impact_brl={a.impact_brl}
              channel={a.channel}
              href={a.href}
              tone="neutral"
            />
          ))}
        </div>
      )}
    </Card>
  );
}
