import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { listProducts, upsertProduct, deleteProduct, getProductIntel, type ProductRow } from "@/lib/products.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Package, Plus, Pencil, Trash2, AlertTriangle, TrendingUp, Boxes } from "lucide-react";
import { toast } from "sonner";

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
  const qc = useQueryClient();
  const runList = useServerFn(listProducts);
  const runIntel = useServerFn(getProductIntel);
  const runUpsert = useServerFn(upsertProduct);
  const runDelete = useServerFn(deleteProduct);

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

  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [open, setOpen] = useState(false);

  const upsertM = useMutation({
    mutationFn: runUpsert,
    onSuccess: () => {
      toast.success("Produto salvo");
      qc.invalidateQueries({ queryKey: ["products", orgId] });
      qc.invalidateQueries({ queryKey: ["products-intel", orgId] });
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteM = useMutation({
    mutationFn: runDelete,
    onSuccess: () => {
      toast.success("Produto removido");
      qc.invalidateQueries({ queryKey: ["products", orgId] });
      qc.invalidateQueries({ queryKey: ["products-intel", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Produtos"
        subtitle="Inteligência ABC/XYZ — onde está sua receita e o que precisa de ação."
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />Novo produto</Button>
            </DialogTrigger>
            <ProductDialog
              initial={editing}
              onSave={(values) => upsertM.mutate({ data: { organization_id: orgId!, id: editing?.id, ...values } })}
              saving={upsertM.isPending}
            />
          </Dialog>
        }
      />

      <Tabs defaultValue="intel">
        <TabsList>
          <TabsTrigger value="intel"><TrendingUp className="mr-2 h-4 w-4" />Inteligência</TabsTrigger>
          <TabsTrigger value="catalog"><Boxes className="mr-2 h-4 w-4" />Catálogo</TabsTrigger>
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
                <Kpi label="Estoque parado" value={`${intel.data.summary.dead_stock} SKUs`} accent="rose" />
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
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Estoque</TableHead>
                      <TableHead>Recomendação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {intel.data.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Cadastre produtos e registre itens de pedido para ver a análise.</TableCell></TableRow>
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

        <TabsContent value="catalog" className="mt-4">
          <Card className="overflow-hidden">
            {products.isLoading ? <Skeleton className="h-64" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(products.data ?? []).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                      <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      Nenhum produto cadastrado ainda.
                    </TableCell></TableRow>
                  ) : products.data!.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.sku ?? "—"}</TableCell>
                      <TableCell>{p.category ?? "—"}</TableCell>
                      <TableCell className="text-right">{fmt(Number(p.unit_price))}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(Number(p.unit_cost))}</TableCell>
                      <TableCell className="text-right">{fmtNum(Number(p.stock_qty))}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => {
                            if (confirm(`Remover "${p.name}"?`)) deleteM.mutate({ data: { id: p.id } });
                          }}>
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        </div>
                      </TableCell>
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

function ProductDialog({ initial, onSave, saving }: { initial: ProductRow | null; onSave: (v: { name: string; sku: string | null; category: string | null; unit_price: number; unit_cost: number; stock_qty: number }) => void; saving: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [price, setPrice] = useState(initial?.unit_price ?? 0);
  const [cost, setCost] = useState(initial?.unit_cost ?? 0);
  const [stock, setStock] = useState(initial?.stock_qty ?? 0);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>SKU</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} /></div>
        <div><Label>Categoria</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
        <div><Label>Preço</Label><Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>
        <div><Label>Custo</Label><Input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} /></div>
        <div><Label>Estoque</Label><Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave({ name, sku: sku || null, category: category || null, unit_price: price, unit_cost: cost, stock_qty: stock })} disabled={!name || saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
