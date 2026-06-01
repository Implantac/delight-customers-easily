import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { getOrgConsolidated, type ConsolidatedRow } from "@/lib/org-consolidated.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, TrendingUp } from "lucide-react";

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
        title="Dashboard Executivo Consolidado"
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

function KpiCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}
