import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Boxes, Plus, Trash2, Pencil, UserPlus, RotateCcw, History, Package, AlertCircle, DollarSign, ShieldAlert } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import {
  listAssets, upsertAsset, deleteAsset, assignAsset, returnAsset, listAssetHistory,
} from "@/lib/assets.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ErpReadOnlyBanner } from "@/components/erp-readonly-banner";

export const Route = createFileRoute("/_app/assets")({ component: AssetsPage });

const STATUS_LABEL: Record<string, string> = {
  in_stock: "Em estoque", assigned: "Atribuído", maintenance: "Manutenção", retired: "Retirado",
};
const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  in_stock: "secondary", assigned: "default", maintenance: "outline", retired: "destructive",
};

function emptyDraft() {
  return {
    name: "", category: "", serial_number: "", manufacturer: "", model: "",
    status: "in_stock", cost: "0", purchased_at: "", warranty_until: "", notes: "",
  };
}

function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function AssetsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listAssets);
  const saveFn = useServerFn(upsertAsset);
  const delFn = useServerFn(deleteAsset);
  const assignFn = useServerFn(assignAsset);
  const returnFn = useServerFn(returnAsset);
  const historyFn = useServerFn(listAssetHistory);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [dlg, setDlg] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(emptyDraft());

  const [assignDlg, setAssignDlg] = useState<any>(null);
  const [assignDraft, setAssignDraft] = useState({ company_id: "", contact_id: "", notes: "" });

  const [returnDlg, setReturnDlg] = useState<any>(null);
  const [returnDraft, setReturnDraft] = useState({ new_status: "in_stock", notes: "" });

  const [historyDlg, setHistoryDlg] = useState<any>(null);

  const q = useQuery({
    queryKey: ["assets", orgId, statusFilter, search],
    queryFn: () => listFn({ data: { organization_id: orgId!, status: statusFilter, search: search || undefined } }),
    enabled: !!orgId,
  });

  const historyQ = useQuery({
    queryKey: ["asset-history", historyDlg?.id],
    queryFn: () => historyFn({ data: { asset_id: historyDlg.id } }),
    enabled: !!historyDlg?.id,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets"] });

  const save = useMutation({
    mutationFn: async () => saveFn({
      data: {
        id: editId ?? undefined,
        organization_id: orgId!,
        name: draft.name.trim(),
        category: draft.category || null,
        serial_number: draft.serial_number || null,
        manufacturer: draft.manufacturer || null,
        model: draft.model || null,
        status: draft.status,
        cost: parseFloat(draft.cost) || 0,
        purchased_at: draft.purchased_at || null,
        warranty_until: draft.warranty_until || null,
        notes: draft.notes || null,
      },
    }),
    onSuccess: () => { toast.success("Ativo salvo"); setDlg(false); setDraft(emptyDraft()); setEditId(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const doAssign = useMutation({
    mutationFn: async () => assignFn({
      data: {
        organization_id: orgId!,
        asset_id: assignDlg.id,
        company_id: assignDraft.company_id || null,
        contact_id: assignDraft.contact_id || null,
        notes: assignDraft.notes || null,
      },
    }),
    onSuccess: () => { toast.success("Ativo atribuído"); setAssignDlg(null); setAssignDraft({ company_id: "", contact_id: "", notes: "" }); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const doReturn = useMutation({
    mutationFn: async () => returnFn({
      data: { asset_id: returnDlg.id, new_status: returnDraft.new_status, notes: returnDraft.notes || null },
    }),
    onSuccess: () => { toast.success("Ativo devolvido"); setReturnDlg(null); setReturnDraft({ new_status: "in_stock", notes: "" }); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const assets = q.data?.assets ?? [];
  const totals = q.data?.totals ?? { total: 0, in_stock: 0, assigned: 0, maintenance: 0, retired: 0, total_cost: 0, assigned_cost: 0, expiring_warranty: 0 };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <ErpReadOnlyBanner entity="Ativos" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Boxes className="h-7 w-7" /> Gestão de Ativos
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle equipamentos, licenças e itens entregues a clientes com histórico completo.
          </p>
        </div>
        {false && (<Button onClick={() => { setEditId(null); setDraft(emptyDraft()); setDlg(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo ativo
        </Button>)}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Package className="h-4 w-4" /> Total</div>
          <div className="text-2xl font-bold mt-1">{totals.total}</div>
          <div className="text-xs text-muted-foreground">{totals.in_stock} em estoque · {totals.assigned} atribuídos</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" /> Valor total</div>
          <div className="text-2xl font-bold mt-1">{fmtMoney(totals.total_cost)}</div>
          <div className="text-xs text-muted-foreground">{fmtMoney(totals.assigned_cost)} em campo</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Manutenção</div>
          <div className="text-2xl font-bold mt-1 text-orange-600">{totals.maintenance}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Garantia ≤ 90d</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{totals.expiring_warranty}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="in_stock">Em estoque</SelectItem>
                <SelectItem value="assigned">Atribuído</SelectItem>
                <SelectItem value="maintenance">Manutenção</SelectItem>
                <SelectItem value="retired">Retirado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-64">
            <Label className="text-xs">Buscar</Label>
            <Input placeholder="Nome ou número de série..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {q.isLoading ? <Skeleton className="h-64 w-full" /> :
       assets.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Boxes className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum ativo cadastrado.</p>
        </CardContent></Card>
       ) : (
        <div className="space-y-2">
          {assets.map((a: any) => (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <Package className="h-10 w-10 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{a.name}</span>
                    <Badge variant={STATUS_BADGE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                    {a.category && <Badge variant="outline">{a.category}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                    {a.manufacturer && <span>{a.manufacturer} {a.model}</span>}
                    {a.serial_number && <span>S/N: {a.serial_number}</span>}
                    {a.warranty_until && <span>Garantia até {new Date(a.warranty_until).toLocaleDateString("pt-BR")}</span>}
                    {a.status === "assigned" && a.assigned_at && (
                      <span>Atribuído em {new Date(a.assigned_at).toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{fmtMoney(Number(a.cost ?? 0))}</div>
                </div>
                <div className="flex gap-1">
                  {a.status === "assigned" ? (
                    <Button size="sm" variant="outline" onClick={() => { setReturnDlg(a); setReturnDraft({ new_status: "in_stock", notes: "" }); }}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Devolver
                    </Button>
                  ) : a.status === "in_stock" ? (
                    <Button size="sm" variant="outline" onClick={() => { setAssignDlg(a); setAssignDraft({ company_id: "", contact_id: "", notes: "" }); }}>
                      <UserPlus className="h-3 w-3 mr-1" /> Atribuir
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" onClick={() => setHistoryDlg(a)}><History className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => {
                    setEditId(a.id);
                    setDraft({
                      name: a.name, category: a.category ?? "", serial_number: a.serial_number ?? "",
                      manufacturer: a.manufacturer ?? "", model: a.model ?? "",
                      status: a.status, cost: String(a.cost ?? 0),
                      purchased_at: a.purchased_at ?? "", warranty_until: a.warranty_until ?? "",
                      notes: a.notes ?? "",
                    });
                    setDlg(true);
                  }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir ativo?")) remove.mutate(a.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
       )}

      {/* Edit asset */}
      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar ativo" : "Novo ativo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Notebook Dell Latitude" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Notebook, Licença, Mobiliário..." />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_stock">Em estoque</SelectItem>
                    <SelectItem value="assigned">Atribuído</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                    <SelectItem value="retired">Retirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Fabricante</Label>
                <Input value={draft.manufacturer} onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })} />
              </div>
              <div>
                <Label>Modelo</Label>
                <Input value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
              </div>
              <div>
                <Label>Nº de série</Label>
                <Input value={draft.serial_number} onChange={(e) => setDraft({ ...draft, serial_number: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Custo (R$)</Label>
                <Input type="number" step="0.01" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} />
              </div>
              <div>
                <Label>Comprado em</Label>
                <Input type="date" value={draft.purchased_at} onChange={(e) => setDraft({ ...draft, purchased_at: e.target.value })} />
              </div>
              <div>
                <Label>Garantia até</Label>
                <Input type="date" value={draft.warranty_until} onChange={(e) => setDraft({ ...draft, warranty_until: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(false)}>Cancelar</Button>
            <Button disabled={!draft.name.trim()} onClick={() => save.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign */}
      <Dialog open={!!assignDlg} onOpenChange={(o) => !o && setAssignDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir {assignDlg?.name}</DialogTitle>
            <DialogDescription>Informe a empresa e/ou contato responsável.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ID da empresa (opcional)</Label>
              <Input value={assignDraft.company_id} onChange={(e) => setAssignDraft({ ...assignDraft, company_id: e.target.value })} />
            </div>
            <div>
              <Label>ID do contato (opcional)</Label>
              <Input value={assignDraft.contact_id} onChange={(e) => setAssignDraft({ ...assignDraft, contact_id: e.target.value })} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={assignDraft.notes} onChange={(e) => setAssignDraft({ ...assignDraft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDlg(null)}>Cancelar</Button>
            <Button disabled={!assignDraft.company_id && !assignDraft.contact_id} onClick={() => doAssign.mutate()}>Atribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return */}
      <Dialog open={!!returnDlg} onOpenChange={(o) => !o && setReturnDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver {returnDlg?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Status após devolução</Label>
              <Select value={returnDraft.new_status} onValueChange={(v) => setReturnDraft({ ...returnDraft, new_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">Em estoque</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                  <SelectItem value="retired">Retirar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notas da devolução</Label>
              <Textarea rows={2} value={returnDraft.notes} onChange={(e) => setReturnDraft({ ...returnDraft, notes: e.target.value })} placeholder="Estado do equipamento, avarias..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnDlg(null)}>Cancelar</Button>
            <Button onClick={() => doReturn.mutate()}>Confirmar devolução</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={!!historyDlg} onOpenChange={(o) => !o && setHistoryDlg(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico — {historyDlg?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-auto">
            {historyQ.data?.history.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atribuição registrada.</p>
            )}
            {historyQ.data?.history.map((h: any) => (
              <div key={h.id} className="border rounded p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {h.company_id ? `Empresa ${h.company_id.slice(0, 8)}…` : `Contato ${(h.contact_id ?? "").slice(0, 8)}…`}
                  </div>
                  <Badge variant={h.returned_at ? "outline" : "default"}>
                    {h.returned_at ? "Devolvido" : "Ativo"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(h.assigned_at).toLocaleDateString("pt-BR")}
                  {h.returned_at && ` → ${new Date(h.returned_at).toLocaleDateString("pt-BR")}`}
                </div>
                {h.notes && <p className="text-sm mt-1">{h.notes}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
