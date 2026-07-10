import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowRight, MessageSquare } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { listChurnRisk } from "@/lib/churn-risk.functions";
import { whatsappLink } from "@/lib/wa";

const fmtBRL = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(n));

const RISK_CLS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-700 border-red-500/30",
  high: "bg-orange-500/15 text-orange-700 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-700 border-amber-500/30",
};

/**
 * Card "Risco de churn" para o Dashboard.
 * Top 5 clientes com maior probabilidade de churn (modelo de IA).
 */
export function ChurnRiskCard() {
  const { orgId } = useCurrentOrg();
  const listFn = useServerFn(listChurnRisk);

  const q = useQuery({
    queryKey: ["dashboard-churn-risk", orgId],
    enabled: !!orgId,
    queryFn: () => listFn({ data: { organization_id: orgId!, limit: 5 } }),
    staleTime: 10 * 60_000,
  });

  return (
    <Card className="p-4 border-border/60 bg-card">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 shrink-0 grid place-items-center rounded-md border border-border/60 bg-card">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold tracking-tight truncate">Risco de Churn</h3>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 truncate">Retenção preditiva</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-500/10" asChild>
          <Link to="/inteligencia-comercial">
            Ver <ArrowRight className="ml-0.5 h-3 w-3" />
          </Link>
        </Button>
      </div>

      <div className="space-y-1.5">
        {q.isLoading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : !q.data?.items.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cliente em risco no momento. Modelo é recalculado periodicamente.
          </p>
        ) : (
          q.data.items.map((c: any) => {
            const wa = c.primary_phone ? whatsappLink(c.primary_phone) : null;
            const cls = RISK_CLS[c.risk_level] ?? "bg-muted text-muted-foreground";
            return (
              <div
                key={c.erp_customer_id}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  {c.company_id ? (
                    <Link
                      to="/companies/$id"
                      params={{ id: c.company_id }}
                      className="block truncate font-medium hover:underline"
                    >
                      {c.display_name ?? "Sem nome"}
                    </Link>
                  ) : (
                    <span className="block truncate font-medium">{c.display_name ?? "Sem nome"}</span>
                  )}
                  <p className="text-[11px] text-muted-foreground truncate">
                    {Math.round(c.churn_probability * 100)}% risco · {fmtBRL(c.monetary)}
                    {c.top_driver ? ` · ${c.top_driver}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className={`shrink-0 text-[10px] uppercase ${cls}`}>
                  {c.risk_level}
                </Badge>
                {wa && (
                  <Button asChild variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                      <MessageSquare className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
