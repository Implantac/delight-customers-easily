import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { getOrgConsolidated, type ConsolidatedRow } from "@/lib/org-consolidated.functions";
import { getExecutiveSignals, type ExecutiveSignal, type SignalTone } from "@/lib/executive-signals.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Building2, TrendingUp, AlertTriangle, Sparkles, Wallet, Target, MapPin, GitBranch, ArrowRight, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SalesVelocityCard } from "@/components/sales-velocity-card";

export const Route = createFileRoute("/_app/dashboard-executivo")({
  component: DashboardExecutivoPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Não encontrado.</div>,
});

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

const typeLabel: Record<ConsolidatedRow["org_type"], string> = {
  tenant: "Grupo",
  company: "Empresa",
  branch: "Filial",
};

function DashboardExecutivoPage() {
  const { org } = useCurrentOrg();
  const [days, setDays] = useState(90);
  const fetchFn = useServerFn(getOrgConsolidated);

  const q = useQuery({
    queryKey: ["org-consolidated", org?.id, days],
    queryFn: () => fetchFn({ data: { orgId: org!.id, days } }),
    enabled: !!org?.id,
  });

  const totals = q.data?.totals;
  const rows = (q.data?.rows ?? []).filter(r => r.org_type !== "tenant");

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Gestão Comercial Global"
        subtitle="Visão tenant → empresas → filiais. Receita, pedidos e clientes únicos no período."
        icon={Building2}
        action={
          <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {q.isLoading || !totals ? (
          [0,1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <KpiCard label="Receita" value={brl(totals.revenue)} icon={<TrendingUp className="h-4 w-4" />} />
            <KpiCard label="Pedidos" value={totals.orders.toLocaleString("pt-BR")} />
            <KpiCard label="Clientes únicos" value={totals.customers.toLocaleString("pt-BR")} />
            <KpiCard label="Empresas" value={String(totals.companies)} />
            <KpiCard label="Filiais" value={String(totals.branches)} />
          </>
        )}
      </div>

      <SignalsPanel orgId={org?.id} />

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Clientes únicos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? (
              [0,1,2].map(i => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton className="h-6" /></TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Sem unidades filhas (empresas/filiais) configuradas neste grupo.
                </TableCell>
              </TableRow>
            ) : (
              rows.map(r => (
                <TableRow key={r.org_id}>
                  <TableCell className="font-medium">{r.org_name}</TableCell>
                  <TableCell>
                    <Badge variant={r.org_type === "company" ? "default" : "secondary"}>
                      {typeLabel[r.org_type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{brl(Number(r.revenue))}</TableCell>
                  <TableCell className="text-right">{Number(r.orders_count).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right">{Number(r.distinct_customers).toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground">
        Fonte: <code>get_org_consolidated_rollup</code> sobre <code>erp_sales_history</code>.
        O grupo (tenant) não é somado para evitar dupla contagem — totais agregam apenas empresas e filiais.
      </p>
    </div>
  );
}

const TONE_META: Record<SignalTone, { icon: React.ComponentType<{ className?: string }>; ring: string; badge: string; label: string }> = {
  critical: { icon: AlertTriangle, ring: "border-rose-500/40 bg-rose-500/5", badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300", label: "Crítico" },
  warn: { icon: AlertTriangle, ring: "border-amber-500/40 bg-amber-500/5", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300", label: "Atenção" },
  opportunity: { icon: Sparkles, ring: "border-emerald-500/40 bg-emerald-500/5", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", label: "Oportunidade" },
  info: { icon: GitBranch, ring: "border-border bg-card", badge: "bg-muted text-muted-foreground", label: "Sinal" },
};

const CATEGORY_ICON: Record<ExecutiveSignal["category"], React.ComponentType<{ className?: string }>> = {
  churn: AlertTriangle,
  recompra: Sparkles,
  carteira: Wallet,
  meta: Target,
  cobertura: MapPin,
  pipeline: GitBranch,
};

function SignalsPanel({ orgId }: { orgId?: string }) {
  const run = useServerFn(getExecutiveSignals);
  const q = useQuery({
    queryKey: ["executive-signals", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-md border border-border/60 bg-card">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold tracking-tight">Sinais → Ações da IA</h3>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              Consolidação de churn, recompra, carteira, meta e cobertura
            </p>
          </div>
        </div>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (q.data?.signals ?? []).length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Nenhum sinal crítico no momento — operação estável.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {q.data!.signals.map((s) => {
            const meta = TONE_META[s.tone];
            const CatIcon = CATEGORY_ICON[s.category];
            return (
              <div
                key={s.key}
                className={cn("group flex flex-col justify-between rounded-lg border p-3 transition-colors hover:border-primary/50", meta.ring)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider", meta.badge)}>
                        {meta.label}
                      </span>
                    </div>
                    {s.metric && (
                      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{s.metric}</span>
                    )}
                  </div>
                  <p className="mt-2 font-display text-[13px] font-semibold leading-snug">{s.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{s.reason}</p>
                </div>
                <Button asChild size="sm" variant="secondary" className="mt-3 h-7 justify-between text-[11px]">
                  <Link to={s.cta.href as any}>
                    {s.cta.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function KpiCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}
