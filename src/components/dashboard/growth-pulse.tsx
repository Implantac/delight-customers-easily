import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { getUseSuccessReport } from "@/lib/use-success.functions";

/**
 * Growth Pulse — faixa executiva no topo do Dashboard.
 * Mostra o USE Success Score + top 1 ação recomendada da IA,
 * conectando o Dashboard operacional ao índice estratégico.
 */
export function GrowthPulse() {
  const { orgId } = useCurrentOrg();
  const fn = useServerFn(getUseSuccessReport);
  const q = useQuery({
    queryKey: ["growth-pulse", orgId],
    enabled: !!orgId,
    queryFn: () => fn({ data: { organization_id: orgId! } }),
    staleTime: 5 * 60_000,
  });

  if (q.isLoading || !q.data) {
    return (
      <Card className="p-3 sm:p-4">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  const r = q.data;
  const tone =
    r.classification === "excelente" ? "text-emerald-500 border-emerald-500/40 bg-emerald-500/10"
    : r.classification === "boa" ? "text-blue-500 border-blue-500/40 bg-blue-500/10"
    : r.classification === "atencao" ? "text-amber-500 border-amber-500/40 bg-amber-500/10"
    : "text-rose-500 border-rose-500/40 bg-rose-500/10";
  const TrendIcon = r.revenue.growth > 0.02 ? TrendingUp : r.revenue.growth < -0.02 ? TrendingDown : Minus;
  const action = r.actions[0];

  return (
    <Card className="p-3 sm:p-4 border-border/60">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-4">
        {/* Score */}
        <Link to="/use-success" className="group flex items-center gap-3 min-w-0">
          <div className={`grid h-14 w-14 sm:h-16 sm:w-16 shrink-0 place-items-center rounded-full border-2 ${tone}`}>
            <span className="font-display text-lg sm:text-xl font-bold tabular-nums">{r.score}</span>
          </div>
          <div className="min-w-0 hidden sm:block">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                USE Success
              </span>
            </div>
            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {r.headline}
            </p>
          </div>
        </Link>

        {/* Trend + top action */}
        <div className="min-w-0 border-l border-border/50 pl-3 sm:pl-4">
          <div className="flex items-center gap-1.5 mb-0.5">
            <TrendIcon className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Próxima jogada da IA
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-foreground truncate">
            {action?.title ?? "Nenhuma ação urgente — mantenha a cadência."}
          </p>
          {action?.reason && (
            <p className="text-[11px] text-muted-foreground truncate">{action.reason}</p>
          )}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant="outline" className={`h-fit py-0.5 px-1.5 text-[10px] capitalize ${tone}`}>
            {r.classification}
          </Badge>
          <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
            <Link to={action?.href as any ?? "/use-success"}>
              Ver <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
