import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { CheckinButton } from "@/components/checkin-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sun, CheckSquare, Target, MessageSquare, Calendar as CalIcon,
  ArrowRight, Trophy, Flame,
} from "lucide-react";
import { listMyTasks } from "@/lib/mytasks.functions";
import { getForecast } from "@/lib/forecast.functions";

export const Route = createFileRoute("/_app/meu-dia")({ component: MyDayPage });

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}

/**
 * Meu Dia — tela do representante.
 * Responde "o que preciso fazer hoje para vender mais?" focado no usuário logado:
 *  • Plano do dia (IA — recomendações priorizadas)
 *  • Tarefas de hoje (próximas / vencidas)
 *  • Top oportunidades minhas (carteira do dia)
 *  • Compromissos da agenda
 *  • Conversas pendentes (WhatsApp/atividades não respondidas)
 *  • Minha meta e gap restante
 */
function MyDayPage() {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();

  const callTasks = useServerFn(listMyTasks);
  const callForecast = useServerFn(getForecast);

  const tasks = useQuery({
    queryKey: ["my-day-tasks", orgId, user?.id],
    enabled: !!orgId,
    queryFn: () => callTasks({ data: { organization_id: orgId!, include_completed: false } }),
  });

  const fc = useQuery({
    queryKey: ["my-day-forecast", orgId],
    enabled: !!orgId,
    queryFn: () => callForecast({ data: { organization_id: orgId! } }),
    staleTime: 5 * 60_000,
  });

  const myDeals = useQuery({
    queryKey: ["my-day-deals", orgId, user?.id],
    enabled: !!orgId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, title, value, stage, expected_close, companies(name)")
        .eq("organization_id", orgId!)
        .eq("user_id", user!.id)
        .not("stage", "in", "(won,lost)")
        .order("value", { ascending: false })
        .limit(8);
      return (data ?? []) as any[];
    },
  });

  const todayEvents = useQuery({
    queryKey: ["my-day-cal", orgId, user?.id],
    enabled: !!orgId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, title, due_date, type")
        .eq("organization_id", orgId!)
        .eq("user_id", user!.id)
        .eq("completed", false)
        .gte("due_date", startOfDay().toISOString())
        .lte("due_date", endOfDay().toISOString())
        .order("due_date");
      return (data ?? []) as any[];
    },
  });

  const myFc = (fc.data?.reps ?? []).find((r) => r.user_id === user?.id);

  const now = Date.now();
  const allTasks = tasks.data?.tasks ?? [];
  const overdue = allTasks.filter(
    (t) => t.due_date && new Date(t.due_date).getTime() < startOfDay().getTime(),
  );
  const today = allTasks.filter(
    (t) => t.due_date && new Date(t.due_date).getTime() >= startOfDay().getTime() && new Date(t.due_date).getTime() <= endOfDay().getTime(),
  );
  const upcoming = allTasks.filter((t) => !t.due_date || new Date(t.due_date).getTime() > endOfDay().getTime()).slice(0, 6);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();
  const first = (user?.user_metadata?.full_name ?? user?.email ?? "").split(" ")[0];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        icon={Sun}
        title={`${greeting}${first ? `, ${first}` : ""}`}
        subtitle={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        action={<CheckinButton size="default" />}
      />

      {/* Métricas pessoais — meta, gap, atingimento */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Vendido no mês</span><Trophy className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <p className="mt-1 text-2xl font-semibold">{myFc ? fmtBRL(myFc.won) : "—"}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Ganho até agora no mês</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Minha meta</span><Target className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="mt-1 text-2xl font-semibold">{myFc ? fmtBRL(myFc.target) : "—"}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{myFc?.attainment ?? 0}% atingido</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Falta fechar</span><Flame className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="mt-1 text-2xl font-semibold">{myFc ? fmtBRL(Math.max(0, myFc.gap)) : "—"}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {myFc && myFc.gap <= 0 ? "Meta batida 🎉" : "para bater a meta do mês"}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tarefas pra hoje</span><CheckSquare className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="mt-1 text-2xl font-semibold">{today.length + overdue.length}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {overdue.length > 0 ? `${overdue.length} atrasadas` : "Nenhuma atrasada"}
          </p>
        </Card>
      </div>

      {/* Plano IA + Tarefas */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <NextActionBlock surface="my-day" title="Plano sugerido pela IA" showRegenerate />

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Minhas tarefas</h3>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/mytasks">Ver todas <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>

          {tasks.isLoading ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              {overdue.length > 0 && (
                <TaskGroup label={`Atrasadas (${overdue.length})`} tone="destructive" items={overdue.slice(0, 5)} />
              )}
              <TaskGroup label={`Hoje (${today.length})`} tone="primary" items={today.slice(0, 6)} empty="Sem tarefas para hoje." />
              {upcoming.length > 0 && (
                <TaskGroup label="Próximas" tone="muted" items={upcoming} />
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Agenda do dia + Carteira prioritária */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalIcon className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Agenda de hoje</h3>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/calendar">Agenda <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {todayEvents.isLoading ? (
              <><Skeleton className="h-10" /><Skeleton className="h-10" /></>
            ) : (todayEvents.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum compromisso hoje. Use o tempo livre pra prospectar.</p>
            ) : (
              (todayEvents.data ?? []).map((e) => {
                const hr = new Date(e.due_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                const past = new Date(e.due_date).getTime() < now;
                return (
                  <div key={e.id} className={`flex items-center gap-3 rounded-md border p-2.5 ${past ? "opacity-60" : ""}`}>
                    <span className="text-xs font-mono w-12 text-muted-foreground">{hr}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      {e.type && <p className="truncate text-[11px] text-muted-foreground">{e.type}</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Minha carteira prioritária</h3>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/pipeline">Pipeline <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {myDeals.isLoading ? (
              <><Skeleton className="h-12" /><Skeleton className="h-12" /></>
            ) : (myDeals.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem oportunidades abertas. Comece em{" "}
                <Link to="/marketing" className="underline">Leads</Link>.
              </p>
            ) : (
              (myDeals.data ?? []).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {d.companies?.name ?? "Sem empresa"}
                      {d.expected_close ? ` · fecha ${new Date(d.expected_close).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmtBRL(Number(d.value || 0))}</p>
                    <Badge variant="outline" className="mt-0.5 text-[10px]">{d.stage}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Atalho WhatsApp pendente */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-600" />
            <div>
              <h3 className="font-semibold">Conversas pendentes</h3>
              <p className="text-xs text-muted-foreground">Responda WhatsApp antes que estoure o SLA.</p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link to="/whatsapp">Abrir caixa <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

function TaskGroup({
  label, tone, items, empty,
}: {
  label: string;
  tone: "primary" | "destructive" | "muted";
  items: any[];
  empty?: string;
}) {
  const color =
    tone === "destructive" ? "text-destructive" :
    tone === "primary" ? "text-primary" : "text-muted-foreground";
  return (
    <div>
      <p className={`text-[11px] uppercase font-medium tracking-wider ${color}`}>{label}</p>
      <div className="mt-1.5 space-y-1.5">
        {items.length === 0 && empty && (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
        {items.map((t) => (
          <div key={t.id} className="flex items-start gap-2 rounded-md border p-2">
            <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{t.title}</p>
              {t.due_date && (
                <p className="text-[11px] text-muted-foreground">
                  {new Date(t.due_date).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
