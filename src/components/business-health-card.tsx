import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useCurrentOrg } from "@/lib/org";
import { computeBusinessHealth } from "@/lib/business-health.functions";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { HeartPulse, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";

const toneOf = (n: number) =>
  n >= 75 ? "text-emerald-600" : n >= 50 ? "text-amber-600" : "text-destructive";
const barTone = (n: number) =>
  n >= 75 ? "bg-emerald-500" : n >= 50 ? "bg-amber-500" : "bg-destructive";

export function BusinessHealthCard() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(computeBusinessHealth);
  const { data, isLoading } = useQuery({
    queryKey: ["business-health", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data) {
    return (
      <Card className="p-5">
        <Skeleton className="h-8 w-40 mb-4" />
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  const TrendIcon = data.delta == null ? Minus : data.delta > 0 ? TrendingUp : data.delta < 0 ? TrendingDown : Minus;

  return (
    <Card className="p-4 border-border/60 bg-card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 shrink-0 grid place-items-center rounded-md border border-border/60 bg-card">
            <HeartPulse className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold tracking-tight truncate">Saúde do Negócio</h3>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 truncate">Business Health</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-2xl font-display font-semibold leading-none tabular-nums ${toneOf(data.score)}`}>{data.score}</div>
          {data.delta != null && (
            <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground mt-0.5">
              <TrendIcon className="h-3 w-3" />
              {data.delta > 0 ? "+" : ""}{data.delta} pts
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-3">
        {data.pillars.map((p) => (
          <div key={p.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">{p.label}</span>
              <span className={`text-xs font-bold tabular-nums ${toneOf(p.score)}`}>{p.score}</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className={`h-full ${barTone(p.score)} transition-all duration-1000`} style={{ width: `${p.score}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground/70 font-medium leading-tight line-clamp-2" title={p.detail}>{p.value}</p>
          </div>
        ))}
      </div>

      {data.topLevers.length > 0 && (
        <div className="mt-3 border-t border-border/40 pt-3">
          <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground/70 uppercase tracking-[0.12em]">
            Alavancas
          </p>
          <ul className="space-y-1">
            {data.topLevers.slice(0, 3).map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-medium truncate">{l.title}</p>
                    {l.impact_brl ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {l.impact_brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{l.reason}</p>
                </div>
                {l.href && (
                  <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-[10px]">
                    <Link to={l.href}>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
