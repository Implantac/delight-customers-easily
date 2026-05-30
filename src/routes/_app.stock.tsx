import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import {
  listStock, createStockMovement, deleteStockMovement, type StockKind,
} from "@/lib/stock.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Boxes, Plus, ArrowDownToLine, ArrowUpFromLine, RefreshCcw, Trash2 } from "lucide-react";
import { ErpReadOnlyBanner } from "@/components/erp-readonly-banner";

export const Route = createFileRoute("/_app/stock")({ component: StockPage });

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtN = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(v || 0);

const KIND_LABEL: Record<StockKind, string> = { in: "Entrada", out: "Saída", adjust: "Ajuste" };
const KIND_VARIANT: Record<StockKind, "default" | "destructive" | "secondary"> = {
  in: "default", out: "destructive", adjust: "secondary",
};

function StockPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const list = useServerFn(listStock);
  const create = useServerFn(createStockMovement);
  const del = useServerFn(deleteStockMovement);

  const [kindFilter, setKindFilter] = useState<"all" | StockKind>("all");
  const [search, setSearch] = useState("");
  const [openDialog, setOpenDialog] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["stock", orgId, kindFilter, search],
    queryFn: () => list({ data: { organization_id: orgId!, kind: kindFilter, product: search || undefined } }),
    enabled: !!orgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["stock", orgId] });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Movimento excluído"); },
    onError: (e: any) => toast.error(e.message),
  });

  const t = data?.totals;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <ErpReadOnlyBanner entity="Movimentos de estoque" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Boxes className="h-6 w-6 text-primary" /> Estoque
          </h1>
          <p className="text-sm text-muted-foreground">Registre entradas, saídas e ajustes e veja o saldo por produto.</p>
        </div>
        {false && (<Button onClick={() => setOpenDialog(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo movimento
        </Button>)}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi title="Entradas" value={fmtN(t?.in_qty ?? 0)} hint={fmt(t?.in_value ?? 0)}
          icon={<ArrowDownToLine className="h-4 w-4 text-emerald-500" />} />
        <Kpi title="Saídas" value={fmtN(t?.out_qty ?? 0)} hint={fmt(t?.out_value ?? 0)}
          icon={<ArrowUpFromLine className="h-4 w-4 text-destructive" />} />
        <Kpi title="Saldo líquido" value={fmtN(t?.net_qty ?? 0)} accent />
        <Kpi title="Movimentos" value={String(t?.count ?? 0)} icon={<RefreshCcw className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="movements">
        <TabsList>
          <TabsTrigger value="movements">Movimentos</TabsTrigger>
          <TabsTrigger value="balances">Saldo por produto</TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Histórico</CardTitle>
              <div className="flex gap-2">
                <Input placeholder="Filtrar produto…" value={search}
                  onChange={(e) => setSearch(e.target.value)} className="w-48" />
                <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="in">Entrada</SelectItem>
                    <SelectItem value="out">Saída</SelectItem>
                    <SelectItem value="adjust">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : !data?.movements.length ? (
                <p className="text-sm text-muted-foreground">Nenhum movimento.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Custo unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.movements.map((m) => {
                        const total = Number(m.quantity) * Number(m.unit_cost);
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(m.occurred_at).toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell className="font-medium">{m.product_name}</TableCell>
                            <TableCell><Badge variant={KIND_VARIANT[m.kind]}>{KIND_LABEL[m.kind]}</Badge></TableCell>
                            <TableCell className={`text-right font-mono ${m.kind === "out" ? "text-destructive" : m.kind === "in" ? "text-emerald-500" : ""}`}>
                              {m.kind === "out" ? "-" : "+"}{fmtN(Number(m.quantity))}
                            </TableCell>
                            <TableCell className="text-right">{fmt(Number(m.unit_cost))}</TableCell>
                            <TableCell className="text-right font-medium">{fmt(total)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{m.reason ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost"
                                onClick={() => { if (confirm("Excluir movimento?")) delMut.mutate(m.id); }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Saldo agregado</CardTitle></CardHeader>
            <CardContent>
              {!data?.balances.length ? (
                <p className="text-sm text-muted-foreground">Sem dados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="text-right">Valor estimado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.balances.map((b) => (
                        <TableRow key={b.product_name}>
                          <TableCell className="font-medium">{b.product_name}</TableCell>
                          <TableCell className={`text-right font-mono ${b.qty < 0 ? "text-destructive" : ""}`}>
                            {fmtN(b.qty)}
                          </TableCell>
                          <TableCell className="text-right">{fmt(b.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {openDialog && (
        <MovementDialog
          open={openDialog}
          onOpenChange={setOpenDialog}
          orgId={orgId!}
          create={create}
          onSaved={() => { setOpenDialog(false); invalidate(); }}
        />
      )}
    </div>
  );
}

function Kpi({ title, value, hint, icon, accent }: { title: string; value: string; hint?: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${accent ? "text-emerald-500" : ""}`}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function MovementDialog({
  open, onOpenChange, orgId, create, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orgId: string;
  create: ReturnType<typeof useServerFn<typeof createStockMovement>>;
  onSaved: () => void;
}) {
  const [productName, setProductName] = useState("");
  const [kind, setKind] = useState<StockKind>("in");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!productName.trim()) { toast.error("Informe o produto"); return; }
    if (!quantity || quantity <= 0) { toast.error("Quantidade inválida"); return; }
    setLoading(true);
    try {
      await create({
        data: {
          organization_id: orgId,
          product_name: productName.trim(),
          kind, quantity, unit_cost: unitCost,
          reason: reason.trim() || null,
          reference: reference.trim() || null,
        },
      });
      toast.success("Movimento registrado");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo movimento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Produto</Label>
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ex.: Notebook Dell" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as StockKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada</SelectItem>
                  <SelectItem value="out">Saída</SelectItem>
                  <SelectItem value="adjust">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" step="0.001" value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div>
              <Label>Custo unitário</Label>
              <Input type="number" step="0.01" value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Motivo</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Compra, devolução, perda…" />
          </div>
          <div>
            <Label>Referência</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="NF, pedido, OS…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
