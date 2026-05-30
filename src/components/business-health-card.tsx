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
    <Card className="p-5 border-primary/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Business Health Score</h3>
            <p className="text-xs text-muted-foreground">Saúde geral do negócio agora</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold leading-none ${toneOf(data.score)}`}>{data.score}</div>
          {data.delta != null && (
            <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground mt-1">
              <TrendIcon className="h-3 w-3" />
              {data.delta > 0 ? "+" : ""}{data.delta} pts vs. anterior
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        {data.pillars.map((p) => (
          <div key={p.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{p.label}</span>
              <span className={`text-xs font-semibold ${toneOf(p.score)}`}>{p.score}</span>
            </div>
            <div className="h-1.5 bg-muted rounded overflow-hidden">
              <div className={`h-full ${barTone(p.score)}`} style={{ width: `${p.score}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight" title={p.detail}>{p.value}</p>
          </div>
        ))}
      </div>

      {data.topLevers.length > 0 && (
        <div className="mt-5 border-t pt-4">
          <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
            Alavancas de crescimento
          </p>
          <ul className="space-y-2">
            {data.topLevers.map((l, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{l.title}</p>
                    {l.impact_brl ? (
                      <Badge variant="outline" className="text-xs">
                        {l.impact_brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{l.reason}</p>
                </div>
                {l.href && (
                  <Button asChild size="sm" variant="ghost">
                    <Link to={l.href}>
                      Ir
                      <ArrowRight className="h-3 w-3 ml-1" />
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
