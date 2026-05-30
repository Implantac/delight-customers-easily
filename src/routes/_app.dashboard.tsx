import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { DollarSign, Users, Building2, TrendingUp, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { OnboardingChecklist } from "@/components/onboarding-checklist";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const STAGE_LABEL: Record<string, string> = { lead: "Lead", qualified: "Qualif.", proposal: "Proposta", negotiation: "Negoc.", won: "Ganho", lost: "Perdido" };

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const sinceISO = new Date(Date.now() - 1000 * 60 * 60 * 24 * 56).toISOString(); // 8 weeks
      const [contacts, companies, deals, upcoming, activitiesRange] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("id, value, stage"),
        supabase.from("activities").select("id, title, due_date, completed, type").eq("completed", false).order("due_date", { ascending: true, nullsFirst: false }).limit(8),
        supabase.from("activities").select("created_at, completed").gte("created_at", sinceISO),
      ]);
      return {
        contacts: contacts.count ?? 0,
        companies: companies.count ?? 0,
        deals: deals.data ?? [],
        upcoming: upcoming.data ?? [],
        activitiesRange: activitiesRange.data ?? [],
      };
    },
  });

  const deals = data?.deals ?? [];
  const openValue = deals.filter((d) => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + Number(d.value), 0);
  const wonValue = deals.filter((d) => d.stage === "won").reduce((s, d) => s + Number(d.value), 0);
  const openCount = deals.filter((d) => !["won", "lost"].includes(d.stage)).length;
  const wonCount = deals.filter((d) => d.stage === "won").length;
  const lostCount = deals.filter((d) => d.stage === "lost").length;
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;

  const stats = [
    { label: "Pipeline aberto", value: fmtBRL(openValue), sub: `${openCount} negócios`, icon: DollarSign, accent: "text-primary" },
    { label: "Receita ganha", value: fmtBRL(wonValue), sub: `${wonCount} fechados`, icon: TrendingUp, accent: "text-success" },
    { label: "Taxa de conversão", value: `${winRate}%`, sub: "Ganhos vs perdidos", icon: CheckCircle2, accent: "text-warning" },
    { label: "Contatos", value: String(data?.contacts ?? 0), sub: `${data?.companies ?? 0} empresas`, icon: Users, accent: "text-primary" },
  ];

  // deals por estágio para barchart
  const stageData = (["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const).map((stage) => {
    const items = deals.filter((d) => d.stage === stage);
    return { stage: STAGE_LABEL[stage], total: items.reduce((s, d) => s + Number(d.value), 0), count: items.length };
  });

  // atividades por semana (últimas 8 semanas)
  const weeks = Array.from({ length: 8 }).map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (7 - i) * 7);
    return { start: d, label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), criadas: 0, concluidas: 0 };
  });
  for (const a of data?.activitiesRange ?? []) {
    const t = new Date(a.created_at).getTime();
    for (let i = 0; i < weeks.length; i++) {
      const startMs = weeks[i].start.getTime();
      const endMs = i === weeks.length - 1 ? Infinity : weeks[i + 1].start.getTime();
      if (t >= startMs && t < endMs) {
        weeks[i].criadas++;
        if (a.completed) weeks[i].concluidas++;
        break;
      }
    }
  }

  return (
    <div className="p-4 md:p-8">
      <PageHeader title="Dashboard" subtitle="Visão geral do seu CRM" />
      <div className="mt-6"><NextActionBlock surface="dashboard" showRegenerate /></div>
      <div className="mt-6"><OnboardingChecklist /></div>
      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Card
              key={s.label}
              className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[var(--gradient-subtle)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-md bg-accent/60 ${s.accent}`}>
                  <s.icon className="h-4 w-4" />
                </span>
              </div>
              <p className="relative mt-3 text-2xl font-semibold tracking-tight">{s.value}</p>
              <p className="relative mt-1 text-xs text-muted-foreground">{s.sub}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold">Valor por estágio</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="stage" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => fmtBRL(Number(v))}
                />
                <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">Atividades — últimas 8 semanas</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="criadas" fill="var(--primary)" radius={[6, 6, 0, 0]} name="Criadas" />
                <Bar dataKey="concluidas" fill="var(--success)" radius={[6, 6, 0, 0]} name="Concluídas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h3 className="font-semibold">Próximas atividades</h3>
        <div className="mt-4 space-y-3">
          {(data?.upcoming ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma atividade pendente.</p>
          )}
          {(data?.upcoming ?? []).map((a) => {
            const due = a.due_date ? new Date(a.due_date) : null;
            const now = new Date();
            const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
            const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
            const overdue = due && due < startOfToday;
            const today = due && due >= startOfToday && due < startOfTomorrow;
            const badge = overdue
              ? { label: "Atrasada", cls: "bg-destructive/15 text-destructive" }
              : today
                ? { label: "Hoje", cls: "bg-warning/20 text-warning" }
                : null;
            return (
              <div key={a.id} className="flex items-start gap-3 rounded-md border p-3">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    {badge && (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {a.type} {due ? `· ${due.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
