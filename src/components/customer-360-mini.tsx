import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ArrowRight, Trophy, AlertTriangle, MessageSquare } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { listCustomer360 } from "@/lib/customer360.functions";
import { whatsappLink } from "@/lib/wa";

const fmtBRL = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(Number(n));

/**
 * Mini Customer 360 — top 5 campeões + top 5 em risco no Dashboard.
 * Sempre clicável: leva para /customer-360 (lista completa).
 */
export function Customer360Mini() {
  const { orgId } = useCurrentOrg();
  const listFn = useServerFn(listCustomer360);

  const champions = useQuery({
    queryKey: ["c360-mini-champions", orgId],
    enabled: !!orgId,
    queryFn: () =>
      listFn({ data: { organizationId: orgId!, segment: "campeoes", sort: "monetary", limit: 5, offset: 0 } }),
    staleTime: 5 * 60_000,
  });

  const risk = useQuery({
    queryKey: ["c360-mini-risk", orgId],
    enabled: !!orgId,
    queryFn: () =>
      listFn({ data: { organizationId: orgId!, segment: "em_risco", sort: "monetary", limit: 5, offset: 0 } }),
    staleTime: 5 * 60_000,
  });

  const champItems = champions.data?.items ?? [];
  const riskItems = risk.data?.items ?? [];
  const loading = champions.isLoading || risk.isLoading;
  const empty = !loading && champItems.length === 0 && riskItems.length === 0;

  return (
    <Card className="p-8 rounded-[2.5rem] shadow-xl shadow-black/5 border-border/40 bg-gradient-to-br from-card to-primary/5">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-bold text-xl tracking-tight leading-none text-foreground">Customer 360</h3>
            <p className="text-xs text-muted-foreground font-medium mt-1 uppercase tracking-widest opacity-70">Visão Geral da Carteira</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/5 rounded-xl font-bold text-xs uppercase tracking-widest" asChild>
          <Link to="/customer-360">
            Ver tudo <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>

      {empty ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Sem snapshot ainda. Conecte um ERP em{" "}
          <Link to="/integrations" className="underline">Integrações</Link> e clique em{" "}
          <Link to="/customer-360" className="underline">Recalcular</Link>.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Section
            icon={<Trophy className="h-3.5 w-3.5 text-emerald-600" />}
            title="Top campeões"
            items={champItems}
            loading={loading}
            tone="emerald"
          />
          <Section
            icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
            title="Em risco"
            items={riskItems}
            loading={loading}
            tone="amber"
          />
        </div>
      )}
    </Card>
  );
}

function Section({
  icon, title, items, loading, tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: any[];
  loading: boolean;
  tone: "emerald" | "amber";
}) {
  const badgeCls =
    tone === "emerald"
      ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
      : "bg-amber-500/15 text-amber-700 border-amber-500/30";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      {loading ? (
        <>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum cliente.</p>
      ) : (
        items.map((c) => {
          const wa = c.primary_phone ? whatsappLink(c.primary_phone) : null;
          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                {c.company_id ? (
                  <Link
                    to="/companies/$id"
                    params={{ id: c.company_id }}
                    className="truncate font-medium hover:underline block"
                  >
                    {c.display_name ?? "Sem nome"}
                  </Link>
                ) : (
                  <span className="truncate font-medium block">{c.display_name ?? "Sem nome"}</span>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {fmtBRL(c.monetary)} · {c.frequency ?? 0}×
                </p>
              </div>
              <Badge variant="outline" className={`shrink-0 text-[10px] ${badgeCls}`}>
                {tone === "emerald" ? "Campeão" : "Risco"}
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
  );
}
