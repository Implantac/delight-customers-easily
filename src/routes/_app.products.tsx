import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { listProducts, getProductIntel } from "@/lib/products.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, AlertTriangle, TrendingUp, Boxes } from "lucide-react";
import { ErpReadOnlyBanner } from "@/components/erp-readonly-banner";

export const Route = createFileRoute("/_app/products")({ component: ProductsPage });

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

function abcColor(c: string) {
  return c === "A" ? "text-emerald-600 border-emerald-500/40 bg-emerald-500/10"
       : c === "B" ? "text-amber-600 border-amber-500/40 bg-amber-500/10"
       : "text-rose-600 border-rose-500/40 bg-rose-500/10";
}
function xyzColor(c: string) {
  return c === "X" ? "text-blue-600 border-blue-500/40 bg-blue-500/10"
       : c === "Y" ? "text-violet-600 border-violet-500/40 bg-violet-500/10"
       : "text-zinc-600 border-zinc-500/40 bg-zinc-500/10";
}

function ProductsPage() {
  const { orgId } = useCurrentOrg();
  const runList = useServerFn(listProducts);
  const runIntel = useServerFn(getProductIntel);

  const products = useQuery({
    queryKey: ["products", orgId],
    enabled: !!orgId,
    queryFn: () => runList({ data: { organization_id: orgId! } }),
  });
  const intel = useQuery({
    queryKey: ["products-intel", orgId],
    enabled: !!orgId,
    queryFn: () => runIntel({ data: { organization_id: orgId! } }),
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <ErpReadOnlyBanner entity="Produtos" />
      <PageHeader
        title="Inteligência de Portfólio"
        subtitle="Análise comercial ABC/XYZ sobre o catálogo espelhado do ERP. Cadastro e estoque permanecem no ERP."
      />

      <Tabs defaultValue="intel">
        <TabsList>
          <TabsTrigger value="intel"><TrendingUp className="mr-2 h-4 w-4" />Inteligência comercial</TabsTrigger>
          <TabsTrigger value="catalog"><Boxes className="mr-2 h-4 w-4" />Catálogo (ERP)</TabsTrigger>
        </TabsList>

        <TabsContent value="intel" className="space-y-4 mt-4">
          {intel.isLoading || !intel.data ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Receita 180d" value={fmt(intel.data.summary.total_revenue)} />
                <Kpi label="Margem 180d" value={fmt(intel.data.summary.total_margin)} />
                <Kpi label="Curva A (top)" value={`${intel.data.summary.count_A} produtos`} />
                <Kpi label="Risco comercial" value={`${intel.data.summary.dead_stock} SKUs sem giro`} accent="rose" />
              </div>

              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>ABC</TableHead>
                      <TableHead>XYZ</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Margem</TableHead>
                      <TableHead className="text-right">Qtd vendida</TableHead>
                      <TableHead className="text-right">Disponível (ERP)</TableHead>
                      <TableHead>Recomendação comercial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {intel.data.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Sincronize produtos e histórico de vendas do ERP para ver a análise.</TableCell></TableRow>
                    ) : intel.data.rows.map((r) => (
                      <TableRow key={r.product_id}>
                        <TableCell>
                          <p className="font-medium">{r.name}</p>
                          {r.sku && <p className="text-xs text-muted-foreground">{r.sku} · {r.category ?? "sem categoria"}</p>}
                        </TableCell>
                        <TableCell><Badge variant="outline" className={abcColor(r.abc)}>{r.abc}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={xyzColor(r.xyz)}>{r.xyz}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{fmt(r.revenue)}</TableCell>
                        <TableCell className="text-right">{fmt(r.margin)}</TableCell>
                        <TableCell className="text-right">{fmtNum(r.qty_sold)}</TableCell>
                        <TableCell className="text-right">
                          {r.stock_qty === 0 && r.abc === "A" ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                              <AlertTriangle className="h-3 w-3" />{fmtNum(r.stock_qty)}
                            </span>
                          ) : fmtNum(r.stock_qty)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[260px]">{r.suggestion}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="catalog" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Catálogo somente leitura. Cadastro, preço e estoque são gerenciados no ERP e replicados via Connect Hub.
          </p>
          <Card className="overflow-hidden">
            {products.isLoading ? <Skeleton className="h-64" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Preço (ERP)</TableHead>
                    <TableHead className="text-right">Disponível (ERP)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(products.data ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                      <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      Nenhum produto sincronizado do ERP ainda.
                    </TableCell></TableRow>
                  ) : products.data!.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.sku ?? "—"}</TableCell>
                      <TableCell>{p.category ?? "—"}</TableCell>
                      <TableCell className="text-right">{fmt(Number(p.unit_price))}</TableCell>
                      <TableCell className="text-right">{fmtNum(Number(p.stock_qty))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "rose" }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${accent === "rose" ? "text-rose-600" : ""}`}>{value}</p>
    </Card>
  );
}
