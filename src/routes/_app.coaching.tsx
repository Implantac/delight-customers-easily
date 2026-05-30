import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, Clock, Flame, Sparkles, TrendingUp, Zap, ArrowRight, Activity as ActivityIcon,
} from "lucide-react";
import { getCoaching, type NextAction } from "@/lib/coaching.functions";

export const Route = createFileRoute("/_app/coaching")({ component: CoachingPage });

const KIND_META: Record<
  NextAction["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  overdue_task: { label: "Tarefa atrasada", icon: AlertTriangle, tone: "text-red-500 bg-red-500/10" },
  deal_closing_soon: { label: "Fechamento próximo", icon: Zap, tone: "text-amber-500 bg-amber-500/10" },
  hot_lead_no_contact: { label: "Lead quente sem contato", icon: Flame, tone: "text-orange-500 bg-orange-500/10" },
  deal_high_value: { label: "Alto valor", icon: TrendingUp, tone: "text-emerald-500 bg-emerald-500/10" },
  deal_stalled: { label: "Negócio parado", icon: Clock, tone: "text-blue-500 bg-blue-500/10" },
  no_activity_week: { label: "Sem atividade", icon: ActivityIcon, tone: "text-muted-foreground bg-muted" },
};

function CoachingPage() {
  const { orgId } = useCurrentOrg();
  const call = useServerFn(getCoaching);
  const { data, isLoading } = useQuery({
    queryKey: ["coaching", orgId],
    enabled: !!orgId,
    queryFn: () => call({ data: { organization_id: orgId! } }),
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Coaching — o que fazer agora"
        subtitle="Suas próximas melhores ações, ordenadas por impacto em receita."
      />

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <StatCard icon={AlertTriangle} label="Atrasadas" value={data.summary.overdue} tone="text-red-500" />
            <StatCard icon={Zap} label="Fecham em breve" value={data.summary.closingSoon} tone="text-amber-500" />
            <StatCard icon={Flame} label="Leads quentes" value={data.summary.hotLeads} tone="text-orange-500" />
            <StatCard icon={TrendingUp} label="Alto valor" value={data.summary.highValue} tone="text-emerald-500" />
            <StatCard icon={Clock} label="Parados" value={data.summary.stalled} tone="text-blue-500" />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                {data.actions.length} ações priorizadas
              </div>
            </div>
            {data.actions.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                Nenhuma ação pendente. Bom trabalho!
              </div>
            ) : (
              <ul className="divide-y">
                {data.actions.map((a) => {
                  const meta = KIND_META[a.kind];
                  const Icon = meta.icon;
                  return (
                    <li key={a.id} className="flex items-center gap-4 p-4 hover:bg-muted/40">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{a.title}</p>
                          <Badge variant="outline" className="text-xs">{meta.label}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">{a.reason}</p>
                      </div>
                      <div className="hidden items-center gap-2 md:flex">
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Prioridade</div>
                          <div className="text-sm font-semibold">{a.priority}</div>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="secondary">
                        <Link to={a.link}>
                          {a.cta}
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, tone,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </Card>
  );
}
