import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getSalesAgents, aiAgentBrief } from "@/lib/ia-comercial.functions";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { AIRecommendationsButton } from "@/components/ai-recommendations-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Flame, TrendingUp, AlertTriangle, Users, Sparkles, ArrowRight, Loader2, Copy,
} from "lucide-react";

import { toast } from "sonner";

export const Route = createFileRoute("/_app/ia-comercial")({
  component: IAComercialPage,
});

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type AgentKey = "followup" | "opportunities" | "risks" | "reps";

const AGENT_META: Record<AgentKey, { label: string; icon: typeof Flame; tagline: string }> = {
  followup: { label: "Follow-up", icon: Flame, tagline: "Negócios parados que precisam de toque hoje." },
  opportunities: { label: "Oportunidades", icon: TrendingUp, tagline: "Onde existe upsell, cross-sell e recompra agora." },
  risks: { label: "Risco", icon: AlertTriangle, tagline: "Clientes saindo, inadimplentes ou silenciosos." },
  reps: { label: "Representantes", icon: Users, tagline: "Ranking, cobertura e quem precisa de coaching." },
};

function sevBadge(s: "info" | "warn" | "high") {
  if (s === "high") return <Badge variant="destructive">crítico</Badge>;
  if (s === "warn") return <Badge className="bg-amber-500/15 text-amber-600 hover:bg-amber-500/20 border-amber-500/30">atenção</Badge>;
  return <Badge variant="secondary">monitorar</Badge>;
}

function IAComercialPage() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(getSalesAgents);
  const brief = useServerFn(aiAgentBrief);
  const [tab, setTab] = useState<AgentKey>("followup");
  const [briefs, setBriefs] = useState<Partial<Record<AgentKey, string>>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["ia-comercial", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });

  const briefMut = useMutation({
    mutationFn: async (agent: AgentKey) => {
      if (!data) throw new Error("Sem dados");
      const list = data[agent] ?? [];
      const ctx = list
        .slice(0, 10)
        .map((d, i) => `${i + 1}. ${d.title} — ${d.subtitle ?? ""} — ${d.metric ?? ""} — ${d.reason}`)
        .join("\n");
      const r = await brief({ data: { organization_id: orgId!, agent, context: ctx || "Sem detecções." } });
      setBriefs((p) => ({ ...p, [agent]: r.result }));
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar brief"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="IA Comercial"
        subtitle="Quatro agentes olhando seus dados sob lentes diferentes. Tudo o que aparece aqui é acionável."
        icon={Sparkles}
      />

      <NextActionBlock surface="dashboard" title="Ações geradas pela IA Comercial" showRegenerate />

      <AIRecommendationsButton />



      {/* Stats hero (clickable → switch tab) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          loading={isLoading}
          label="Follow-ups atrasados"
          value={data ? `${data.stats.followupOverdue}` : "—"}
          hint="negócios parados 7d+"
          icon={Flame}
          onClick={() => setTab("followup")}
          active={tab === "followup"}
        />
        <StatCard
          loading={isLoading}
          label="Potencial de upsell"
          value={data ? fmt(data.stats.upsellPotential) : "—"}
          hint="histórico de clientes sem deal aberto"
          icon={TrendingUp}
          onClick={() => setTab("opportunities")}
          active={tab === "opportunities"}
        />
        <StatCard
          loading={isLoading}
          label="Receita em risco"
          value={data ? fmt(data.stats.atRiskRevenue) : "—"}
          hint="títulos vencidos em aberto"
          icon={AlertTriangle}
          tone="danger"
          onClick={() => setTab("risks")}
          active={tab === "risks"}
        />
        <StatCard
          loading={isLoading}
          label="Representantes ativos"
          value={data ? `${data.stats.activeReps}` : "—"}
          hint="últimos 30d"
          icon={Users}
          onClick={() => setTab("reps")}
          active={tab === "reps"}
        />
      </div>


      <Tabs value={tab} onValueChange={(v) => setTab(v as AgentKey)}>
        <TabsList className="grid grid-cols-2 lg:grid-cols-4 w-full">
          {(Object.keys(AGENT_META) as AgentKey[]).map((k) => {
            const M = AGENT_META[k];
            const count = data?.[k]?.length ?? 0;
            return (
              <TabsTrigger key={k} value={k} className="gap-2">
                <M.icon className="h-4 w-4" />
                <span>{M.label}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>


        {(Object.keys(AGENT_META) as AgentKey[]).map((k) => {
          const M = AGENT_META[k];
          const list = data?.[k] ?? [];
          return (
            <TabsContent key={k} value={k} className="space-y-4 mt-4">
              <Card className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    <M.icon className="h-4 w-4 text-primary" />
                    Agente {M.label}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{M.tagline}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => briefMut.mutate(k)}
                  disabled={briefMut.isPending || !data}
                  className="gap-2"
                >
                  {briefMut.isPending && briefMut.variables === k ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {briefs[k] ? "Regerar brief IA" : "Gerar brief IA"}
                </Button>
              </Card>

              {briefs[k] && (
                <Card className="p-4 border-primary/30 bg-primary/5">
                  <div className="text-xs uppercase tracking-wide text-primary mb-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Brief do agente
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{briefs[k]}</div>
                </Card>
              )}

              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : list.length === 0 ? (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  Nada detectado por este agente no momento. Volte mais tarde — atualizamos conforme os dados entram.
                </Card>
              ) : (
                <div className="space-y-2">
                  {list.map((d) => (
                    <Card key={d.id} className="p-3 flex items-center gap-3 hover:bg-accent/40 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{d.title}</span>
                          {sevBadge(d.severity)}
                          {d.metric && (
                            <span className="text-xs text-muted-foreground font-mono">{d.metric}</span>
                          )}
                        </div>
                        {d.subtitle && (
                          <div className="text-xs text-muted-foreground mt-0.5">{d.subtitle}</div>
                        )}
                        <div className="text-xs text-foreground/80 mt-1">{d.reason}</div>
                      </div>
                      {d.href && (
                        <Button asChild size="sm" variant="ghost" className="gap-1 shrink-0">
                          <Link to={d.href as any}>
                            Abrir <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}






function StatCard({
  label, value, hint, icon: Icon, loading, tone, onClick, active,
}: {
  label: string; value: string; hint: string; icon: typeof Flame; loading?: boolean;
  tone?: "danger"; onClick?: () => void; active?: boolean;
}) {
  return (
    <Card
      onClick={onClick}
      className={`p-4 transition-all ${
        onClick ? "cursor-pointer hover:border-primary/40 hover:-translate-y-0.5" : ""
      } ${active ? "border-primary/60 ring-1 ring-primary/30" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${tone === "danger" ? "text-destructive" : "text-primary"}`} />
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24 mt-2" />
      ) : (
        <div className={`text-2xl font-semibold mt-1 ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
      )}
      <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
    </Card>
  );
}

