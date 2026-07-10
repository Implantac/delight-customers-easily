import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Flame, ShieldAlert, RefreshCw, Target } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { getGrowthPlan, type GrowthAction } from "@/lib/growth-central.functions";
import { ActionCard, ActionCardEmpty, fmtActionBRL } from "@/components/action-card";

/**
 * Central de Crescimento — "Plano do Dia" unificado.
 * Consolida Prioritários / Em Risco / Reativação em um único painel acionável.
 * Substitui a leitura fragmentada por 3 abas com o mesmo card padronizado.
 */
export function GrowthCentral() {
  const { orgId } = useCurrentOrg();
  const fn = useServerFn(getGrowthPlan);
  const q = useQuery({
    queryKey: ["growth-central", orgId],
    enabled: !!orgId,
    queryFn: () => fn({ data: { organization_id: orgId! } }),
    staleTime: 3 * 60_000,
  });

  if (q.isLoading || !q.data) {
    return (
      <Card className="p-4">
        <Skeleton className="h-8 w-48 mb-3" />
        <Skeleton className="h-32 w-full" />
      </Card>
    );
  }

  const p = q.data;
  const total =
    p.priorities.length + p.risks.length + p.reactivations.length;

  return (
    <Card className="border-border/60 p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border/60 bg-card">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold tracking-tight">
              Central de Crescimento
            </h2>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
              Plano do dia · {total} ações priorizadas pela IA
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="priorities" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="priorities" className="text-[11px] gap-1">
            <Flame className="h-3 w-3" />
            <span className="hidden sm:inline">Prioritários</span>
            <Badge variant="outline" className="h-4 px-1 text-[9px] tabular-nums">{p.priorities.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="risks" className="text-[11px] gap-1">
            <ShieldAlert className="h-3 w-3" />
            <span className="hidden sm:inline">Recuperar</span>
            <Badge variant="outline" className="h-4 px-1 text-[9px] tabular-nums">{p.risks.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="reactivations" className="text-[11px] gap-1">
            <RefreshCw className="h-3 w-3" />
            <span className="hidden sm:inline">Reativar</span>
            <Badge variant="outline" className="h-4 px-1 text-[9px] tabular-nums">{p.reactivations.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="priorities" className="mt-3">
          <ActionList
            items={p.priorities}
            tone="priority"
            emptyMessage="Nenhum negócio aberto priorizado hoje."
            footerLabel="Valor priorizado"
            footerValue={p.totals.priority_value}
          />
        </TabsContent>
        <TabsContent value="risks" className="mt-3">
          <ActionList
            items={p.risks}
            tone="risk"
            emptyMessage="Nenhum cliente em risco alto — carteira estável."
            footerLabel="Receita em risco"
            footerValue={p.totals.risk_value}
          />
        </TabsContent>
        <TabsContent value="reactivations" className="mt-3">
          <ActionList
            items={p.reactivations}
            tone="reactivation"
            emptyMessage="Nenhuma janela de recompra detectada."
            footerLabel="Potencial de recompra"
            footerValue={p.totals.reactivation_value}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function ActionList({
  items, tone, emptyMessage, footerLabel, footerValue,
}: {
  items: GrowthAction[];
  tone: "priority" | "risk" | "reactivation";
  emptyMessage: string;
  footerLabel: string;
  footerValue: number;
}) {
  if (items.length === 0) return <ActionCardEmpty message={emptyMessage} />;
  return (
    <div className="space-y-1.5">
      {items.map((a) => (
        <ActionCard
          key={a.id}
          title={a.title}
          subtitle={a.subtitle}
          reason={a.reason}
          impact_brl={a.impact_brl}
          channel={a.channel}
          deadline={a.deadline}
          href={a.href}
          score={a.score}
          tone={tone}
        />
      ))}
      {footerValue > 0 && (
        <div className="mt-2 flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-2.5 py-1.5">
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {footerLabel}
          </span>
          <span className="font-display text-xs font-semibold tabular-nums text-foreground">
            {fmtActionBRL(footerValue)}
          </span>
        </div>
      )}
    </div>
  );
}
