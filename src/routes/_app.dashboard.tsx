import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { DollarSign, Users, Building2, TrendingUp, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [contacts, companies, deals, activities] = await Promise.all([
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("deals").select("id, value, stage"),
        supabase.from("activities").select("id, title, due_date, completed, type").order("due_date", { ascending: true, nullsFirst: false }).limit(5),
      ]);
      return {
        contacts: contacts.count ?? 0,
        companies: companies.count ?? 0,
        deals: deals.data ?? [],
        activities: activities.data ?? [],
      };
    },
  });

  const deals = data?.deals ?? [];
  const openValue = deals.filter((d) => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + Number(d.value), 0);
  const wonValue = deals.filter((d) => d.stage === "won").reduce((s, d) => s + Number(d.value), 0);
  const openCount = deals.filter((d) => !["won", "lost"].includes(d.stage)).length;
  const wonCount = deals.filter((d) => d.stage === "won").length;
  const winRate = deals.length > 0 ? Math.round((wonCount / (wonCount + deals.filter((d) => d.stage === "lost").length || 1)) * 100) : 0;

  const stats = [
    { label: "Pipeline aberto", value: fmtBRL(openValue), sub: `${openCount} negócios`, icon: DollarSign, accent: "text-primary" },
    { label: "Receita ganha", value: fmtBRL(wonValue), sub: `${wonCount} fechados`, icon: TrendingUp, accent: "text-success" },
    { label: "Taxa de conversão", value: `${winRate}%`, sub: "Ganhos vs perdidos", icon: CheckCircle2, accent: "text-warning" },
    { label: "Contatos", value: String(data?.contacts ?? 0), sub: `${data?.companies ?? 0} empresas`, icon: Users, accent: "text-primary" },
  ];

  return (
    <div className="p-8">
      <PageHeader title="Dashboard" subtitle="Visão geral do seu CRM" />
      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.accent}`} />
      </div>
      )}
            <p className="mt-3 text-2xl font-semibold tracking-tight">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold">Negócios por estágio</h3>
          <div className="mt-4 space-y-3">
            {(["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const).map((stage) => {
              const items = deals.filter((d) => d.stage === stage);
              const sum = items.reduce((s, d) => s + Number(d.value), 0);
              const max = Math.max(...["lead", "qualified", "proposal", "negotiation", "won", "lost"].map((st) => deals.filter((d) => d.stage === st).reduce((s, d) => s + Number(d.value), 0)), 1);
              return (
                <div key={stage}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="capitalize text-muted-foreground">{stageLabel(stage)}</span>
                    <span className="font-medium">{fmtBRL(sum)} · {items.length}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(sum / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">Próximas atividades</h3>
          <div className="mt-4 space-y-3">
            {(data?.activities ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma atividade pendente.</p>
            )}
            {(data?.activities ?? []).map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-md border p-3">
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.type} {a.due_date ? `· ${new Date(a.due_date).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                {a.completed && <CheckCircle2 className="h-4 w-4 text-success" />}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function stageLabel(s: string) {
  return { lead: "Lead", qualified: "Qualificado", proposal: "Proposta", negotiation: "Negociação", won: "Ganho", lost: "Perdido" }[s] ?? s;
}
