import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useCurrentOrg } from "@/lib/org";
import {
  listRecommendations,
  resolveRecommendation,
  generateRecommendations,
} from "@/lib/recommendations.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ArrowRight, Check, X, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Props = {
  /** Surface key, e.g. "dashboard", "pipeline", "carteira", "marketing". */
  surface: string;
  /** Optional override title. Defaults to "Próximas ações recomendadas". */
  title?: string;
  /** Max items rendered. */
  limit?: number;
  /** If true, shows a "regenerate" button (admin-style screens only). */
  showRegenerate?: boolean;
};

/**
 * Unified "Next Action" block. Every key screen embeds this so the user
 * always sees what to DO next — not just what happened.
 */
export function NextActionBlock({
  surface,
  title = "Próximas ações recomendadas",
  limit = 6,
  showRegenerate = false,
}: Props) {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const list = useServerFn(listRecommendations);
  const resolve = useServerFn(resolveRecommendation);
  const generate = useServerFn(generateRecommendations);

  const { data, isLoading } = useQuery({
    queryKey: ["recommendations", orgId, surface, limit],
    enabled: !!orgId,
    queryFn: () => list({ data: { organization_id: orgId!, surface, limit } }),
    refetchOnWindowFocus: false,
  });

  const resolveMut = useMutation({
    mutationFn: (vars: { id: string; status: "done" | "dismissed" }) =>
      resolve({ data: { organization_id: orgId!, ...vars } }),
    onSuccess: (_d, vars) => {
      toast.success(vars.status === "done" ? "Marcada como feita" : "Recomendação descartada");
      qc.invalidateQueries({ queryKey: ["recommendations", orgId, surface] });
    },
  });

  const regenMut = useMutation({
    mutationFn: () => generate({ data: { organization_id: orgId! } }),
    onSuccess: (r) => {
      toast.success(`${r.generated} recomendações geradas`);
      qc.invalidateQueries({ queryKey: ["recommendations", orgId] });
    },
  });

  const items = data?.items ?? [];

  return (
    <Card className="p-6 md:p-8 border-border/40 bg-card/40 backdrop-blur-sm rounded-3xl shadow-xl shadow-black/5">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-display font-bold">{title}</h3>
          {items.length > 0 && (
            <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] bg-primary/20 text-primary border-primary/20">
              {items.length}
            </Badge>
          )}
        </div>
        {showRegenerate && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => regenMut.mutate()}
            disabled={regenMut.isPending}
          >
            <RefreshCcw className={`h-3.5 w-3.5 mr-1 ${regenMut.isPending ? "animate-spin" : ""}`} />
            Recalcular
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">
          Nenhuma ação pendente aqui agora.
          {showRegenerate && " Clique em Recalcular para regerar."}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((r: any) => (
            <li key={r.id} className="py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  {r.impact_brl ? (
                    <Badge variant="outline" className="text-xs">
                      {fmtBRL(Number(r.impact_brl))}
                    </Badge>
                  ) : null}
                  {r.priority >= 85 && (
                    <Badge className="text-xs bg-destructive text-destructive-foreground">
                      urgente
                    </Badge>
                  )}
                </div>
                {r.reason && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.reason}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {r.action_href && (
                  <Button asChild size="sm" variant="default">
                    <Link to={r.action_href}>
                      {r.action_label}
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title="Marcar como feita"
                  onClick={() => resolveMut.mutate({ id: r.id, status: "done" })}
                  disabled={resolveMut.isPending}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  title="Descartar"
                  onClick={() => resolveMut.mutate({ id: r.id, status: "dismissed" })}
                  disabled={resolveMut.isPending}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
