import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCurrentOrg } from "@/lib/org";
import { getGrowthDigest, type GrowthDigest } from "@/lib/growth-digest.functions";
import { cn } from "@/lib/utils";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Teaser compacto do Growth Digest para o Dashboard.
 * Mostra headline da semana + score delta + sparkline 4 semanas + CTA para o relatório completo.
 */
export function GrowthDigestTeaser() {
  const { orgId } = useCurrentOrg();
  const digestFn = useServerFn(getGrowthDigest);

  const q = useQuery({
    queryKey: ["growth-digest-teaser", orgId],
    enabled: !!orgId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const weeks = [3, 2, 1, 0];
      const results = await Promise.all(
        weeks.map((w) =>
          digestFn({ data: { organization_id: orgId!, weeks_back: w } }).catch(() => null),
        ),
      );
      const rows = results
        .map((d, i) => ({ w: weeks[i], d }))
        .filter((r): r is { w: number; d: GrowthDigest } => !!r.d);
      const current = rows.find((r) => r.w === 0)?.d ?? null;
      return { current, rows };
    },
  });

  if (q.isLoading || !q.data?.current) {
    return <Skeleton className="h-32" />;
  }

  const d = q.data.current;
  const Icon = d.score.delta > 0 ? TrendingUp : d.score.delta < 0 ? TrendingDown : Minus;
  const tone = d.score.delta > 0 ? "text-emerald-600" : d.score.delta < 0 ? "text-rose-600" : "text-muted-foreground";
  const spark = q.data.rows.slice().sort((a, b) => b.w - a.w); // ordem cronológica: -3, -2, -1, 0
  const maxRev = Math.max(1, ...spark.map((r) => r.d.revenue.won));

  return (
    <Card className="p-5 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent border-violet-500/20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2 flex-1 min-w-[240px]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-semibold uppercase text-muted-foreground">Growth Digest</span>
            <Badge variant="outline" className="text-[10px]">{d.period.label}</Badge>
          </div>
          <p className="text-sm font-medium leading-snug">{d.headline}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
            <span><span className="font-semibold text-foreground tabular-nums">{brl(d.revenue.won)}</span> fechado</span>
            <span>•</span>
            <span><span className="font-semibold text-foreground tabular-nums">{d.wins.count}</span> negócio(s)</span>
            {d.score.current !== null && (
              <>
                <span>•</span>
                <span className={cn("flex items-center gap-1 font-medium", tone)}>
                  <Icon className="h-3 w-3" />
                  Score {d.score.current}
                  {d.score.previous !== null && (
                    <span>({d.score.delta > 0 ? "+" : ""}{d.score.delta} pts)</span>
                  )}
                </span>
              </>
            )}
          </div>
        </div>

        {spark.length > 1 && (
          <div className="flex items-end gap-1.5 h-12" aria-label="Receita das últimas 4 semanas">
            {spark.map((r) => {
              const h = Math.max(4, Math.round((r.d.revenue.won / maxRev) * 44));
              const active = r.w === 0;
              return (
                <div key={r.w} className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "w-2.5 rounded-sm transition-all",
                      active ? "bg-violet-500" : "bg-violet-500/30",
                    )}
                    style={{ height: `${h}px` }}
                    title={`${r.w === 0 ? "Atual" : `-${r.w} sem`}: ${brl(r.d.revenue.won)}`}
                  />
                  <span className="text-[9px] text-muted-foreground leading-none">
                    {r.w === 0 ? "hj" : `-${r.w}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <Button size="sm" variant="outline" asChild>
          <Link to="/growth-digest">Abrir relatório <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
        </Button>
      </div>
    </Card>
  );
}
