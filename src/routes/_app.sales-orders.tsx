import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import {
  listSalesOrders, upsertSalesOrder, setSalesOrderStatus, deleteSalesOrder, getSalesOrder,
  type SalesOrder,
} from "@/lib/sales-orders.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Package, Plus, Trash2, Pencil, Clock, CheckCircle2, Truck, XCircle, Factory } from "lucide-react";
import { ErpReadOnlyBanner } from "@/components/erp-readonly-banner";

export const Route = createFileRoute("/_app/sales-orders")({ component: SalesOrdersPage });

const fmt = (v: number, c = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(v || 0);

type DraftItem = { description: string; quantity: number; unit_price: number; discount_pct: number };

const STATUS_LABEL: Record<SalesOrder["status"], string> = {
  draft: "Rascunho", confirmed: "Confirmado", in_production: "Em produção",
  shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado",
};
const STATUS_VARIANT: Record<SalesOrder["status"], "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline", confirmed: "secondary", in_production: "secondary",
  shipped: "default", delivered: "default", cancelled: "destructive",
};

function SalesOrdersPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const list = useServerFn(listSalesOrders);
  const save = useServerFn(upsertSalesOrder);
  const setStatus = useServerFn(setSalesOrderStatus);
  const del = useServerFn(deleteSalesOrder);
  const getOne = useServerFn(getSalesOrder);

  const [statusFilter, setStatusFilter] = useState<"all" | SalesOrder["status"]>("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["sales-orders", orgId, statusFilter],
    queryFn: () => list({ data: { organization_id: orgId!, status: statusFilter } }),
    enabled: !!orgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sales-orders", orgId] });
  const statusMut = useMutation({
    mutationFn: (vars: { id: string; status: SalesOrder["status"] }) => setStatus({ data: vars }),
    onSuccess: () => { invalidate(); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Pedido excluído"); },
    onError: (e: any) => toast.error(e.message),
  });

  const t = data?.totals;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <ErpReadOnlyBanner entity="Pedidos de venda" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Package className="h-6 w-6 text-primary" /> Pedidos de Venda
          </h1>
          <p className="text-sm text-muted-foreground">Confirme orçamentos e acompanhe a entrega.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="confirmed">Confirmado</SelectItem>
              <SelectItem value="in_production">Em produção</SelectItem>
              <SelectItem value="shipped">Enviado</SelectItem>
              <SelectItem value="delivered">Entregue</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditingId(null); setOpenDialog(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo pedido
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi title="Total" value={String(t?.count ?? 0)} icon={<Package className="h-4 w-4" />} />
        <Kpi title="Valor total" value={fmt(t?.total_value ?? 0)} />
        <Kpi title="Em andamento" value={fmt(t?.confirmed_value ?? 0)} accent />
        <Kpi title="Entregues" value={String(t?.delivered ?? 0)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lista</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !data?.orders.length ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">#{o.number}</TableCell>
                      <TableCell className="font-medium">{o.title}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{o.order_date}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{o.expected_delivery ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(o.total), o.currency)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {o.status === "draft" && (
                            <Button size="sm" variant="ghost" title="Confirmar"
                              onClick={() => statusMut.mutate({ id: o.id, status: "confirmed" })}>
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </Button>
                          )}
                          {o.status === "confirmed" && (
                            <Button size="sm" variant="ghost" title="Em produção"
                              onClick={() => statusMut.mutate({ id: o.id, status: "in_production" })}>
                              <Factory className="h-4 w-4" />
                            </Button>
                          )}
                          {(o.status === "confirmed" || o.status === "in_production") && (
                            <Button size="sm" variant="ghost" title="Marcar enviado"
                              onClick={() => statusMut.mutate({ id: o.id, status: "shipped" })}>
                              <Truck className="h-4 w-4" />
                            </Button>
                          )}
                          {o.status === "shipped" && (
                            <Button size="sm" variant="ghost" title="Entregue"
                              onClick={() => statusMut.mutate({ id: o.id, status: "delivered" })}>
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </Button>
                          )}
                          {o.status !== "delivered" && o.status !== "cancelled" && (
                            <Button size="sm" variant="ghost" title="Cancelar"
                              onClick={() => statusMut.mutate({ id: o.id, status: "cancelled" })}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(o.id); setOpenDialog(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => { if (confirm("Excluir pedido?")) delMut.mutate(o.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {openDialog && (
        <OrderDialog
          key={editingId ?? "new"}
          open={openDialog}
          onOpenChange={setOpenDialog}
          editingId={editingId}
          orgId={orgId!}
          getOne={getOne}
          save={save}
          onSaved={() => { setOpenDialog(false); invalidate(); }}
        />
      )}
    </div>
  );
}

function Kpi({ title, value, icon, accent }: { title: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${accent ? "text-emerald-500" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function OrderDialog({
  open, onOpenChange, editingId, orgId, getOne, save, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingId: string | null;
  orgId: string;
  getOne: ReturnType<typeof useServerFn<typeof getSalesOrder>>;
  save: ReturnType<typeof useServerFn<typeof upsertSalesOrder>>;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<SalesOrder["status"]>("draft");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expected, setExpected] = useState<string>("");
  const [currency, setCurrency] = useState("BRL");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([
    { description: "", quantity: 1, unit_price: 0, discount_pct: 0 },
  ]);
  const [loading, setLoading] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["sales-order", editingId],
    queryFn: () => getOne({ data: { id: editingId! } }),
    enabled: !!editingId,
  });

  useEffect(() => {
    if (existing) {
      setTitle(existing.order.title);
      setStatus(existing.order.status);
      setOrderDate(existing.order.order_date);
      setExpected(existing.order.expected_delivery ?? "");
      setCurrency(existing.order.currency);
      setDiscount(Number(existing.order.discount));
      setTax(Number(existing.order.tax));
      setNotes(existing.order.notes ?? "");
      if (existing.items.length) {
        setItems(existing.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          discount_pct: Number(i.discount_pct),
        })));
      }
    }
  }, [existing]);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price * (1 - i.discount_pct / 100), 0);
  const total = Math.max(0, subtotal - discount + tax);

  const updateItem = (idx: number, patch: Partial<DraftItem>) =>
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx: number) => setItems((arr) => arr.filter((_, i) => i !== idx));
  const addItem = () => setItems((arr) => [...arr, { description: "", quantity: 1, unit_price: 0, discount_pct: 0 }]);

  const submit = async () => {
    if (!title.trim()) { toast.error("Informe um título"); return; }
    const cleanItems = items.filter((i) => i.description.trim());
    if (!cleanItems.length) { toast.error("Adicione ao menos um item"); return; }
    setLoading(true);
    try {
      await save({
        data: {
          id: editingId ?? undefined,
          organization_id: orgId,
          title: title.trim(),
          status,
          order_date: orderDate,
          expected_delivery: expected || null,
          currency,
          discount, tax,
          notes: notes.trim() || null,
          items: cleanItems,
        },
      });
      toast.success(editingId ? "Pedido atualizado" : "Pedido criado");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar pedido" : "Novo pedido"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Pedido Empresa X" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="in_production">Em produção</SelectItem>
                  <SelectItem value="shipped">Enviado</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data do pedido</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
            <div>
              <Label>Entrega prevista</Label>
              <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </div>
            <div>
              <Label>Moeda</Label>
              <Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Itens</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" /> Adicionar item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => {
                const line = it.quantity * it.unit_price * (1 - it.discount_pct / 100);
                return (
                  <div key={idx} className="grid gap-2 rounded border p-2 md:grid-cols-12">
                    <Input className="md:col-span-5" placeholder="Descrição"
                      value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} />
                    <Input className="md:col-span-2" type="number" step="0.001" placeholder="Qtd"
                      value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
                    <Input className="md:col-span-2" type="number" step="0.01" placeholder="Preço"
                      value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} />
                    <Input className="md:col-span-1" type="number" step="0.01" placeholder="% Desc"
                      value={it.discount_pct} onChange={(e) => updateItem(idx, { discount_pct: Number(e.target.value) })} />
                    <div className="flex items-center justify-end gap-1 text-sm font-medium md:col-span-2">
                      <span>{fmt(line, currency)}</span>
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(idx)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Desconto global</Label>
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Imposto</Label>
              <Input type="number" step="0.01" value={tax} onChange={(e) => setTax(Number(e.target.value))} />
            </div>
            <div className="flex flex-col justify-end">
              <div className="rounded-md bg-muted/40 p-2 text-right text-sm">
                <div>Subtotal: <span className="font-medium">{fmt(subtotal, currency)}</span></div>
                <div className="text-base font-semibold">Total: {fmt(total, currency)}</div>
              </div>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
