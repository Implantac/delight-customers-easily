import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import {
  listSuppliers, upsertSupplier, toggleSupplierActive, deleteSupplier, type Supplier,
} from "@/lib/suppliers.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Truck, Plus, Pencil, Trash2, Power, Mail, Phone } from "lucide-react";
import { ErpReadOnlyBanner } from "@/components/erp-readonly-banner";

export const Route = createFileRoute("/_app/suppliers")({ component: SuppliersPage });

function SuppliersPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const list = useServerFn(listSuppliers);
  const save = useServerFn(upsertSupplier);
  const toggle = useServerFn(toggleSupplierActive);
  const del = useServerFn(deleteSupplier);

  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers", orgId, search, onlyActive],
    queryFn: () => list({ data: { organization_id: orgId!, search: search || undefined, only_active: onlyActive } }),
    enabled: !!orgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["suppliers", orgId] });
  const toggleMut = useMutation({
    mutationFn: (vars: { id: string; is_active: boolean }) => toggle({ data: vars }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Fornecedor excluído"); },
    onError: (e: any) => toast.error(e.message),
  });

  const t = data?.totals;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <ErpReadOnlyBanner entity="Fornecedores" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Truck className="h-6 w-6 text-primary" /> Fornecedores
          </h1>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie seus fornecedores e parceiros.</p>
        </div>
        {false && (<Button onClick={() => { setEditing(null); setOpenDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo fornecedor
        </Button>)}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi title="Total" value={String(t?.count ?? 0)} />
        <Kpi title="Ativos" value={String(t?.active ?? 0)} accent />
        <Kpi title="Inativos" value={String(t?.inactive ?? 0)} />
        <Kpi title="Categorias" value={String(t?.categories ?? 0)} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Lista</CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="only-active" checked={onlyActive} onCheckedChange={setOnlyActive} />
              <Label htmlFor="only-active" className="text-sm">Só ativos</Label>
            </div>
            <Input placeholder="Buscar nome, CNPJ…" value={search}
              onChange={(e) => setSearch(e.target.value)} className="w-56" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !data?.suppliers.length ? (
            <p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razão social</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.suppliers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.legal_name}</div>
                        {s.trade_name && <div className="text-xs text-muted-foreground">{s.trade_name}</div>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.document ?? "—"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{s.contact_name ?? "—"}</div>
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {s.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                          {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.category ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.is_active ? "default" : "outline"}>
                          {s.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" title={s.is_active ? "Desativar" : "Ativar"}
                            onClick={() => toggleMut.mutate({ id: s.id, is_active: !s.is_active })}>
                            <Power className={`h-4 w-4 ${s.is_active ? "text-emerald-500" : "text-muted-foreground"}`} />
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => { setEditing(s); setOpenDialog(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => { if (confirm("Excluir fornecedor?")) delMut.mutate(s.id); }}>
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
        <SupplierDialog
          key={editing?.id ?? "new"}
          open={openDialog}
          onOpenChange={setOpenDialog}
          editing={editing}
          orgId={orgId!}
          save={save}
          onSaved={() => { setOpenDialog(false); invalidate(); }}
        />
      )}
    </div>
  );
}

function Kpi({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${accent ? "text-emerald-500" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function SupplierDialog({
  open, onOpenChange, editing, orgId, save, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Supplier | null;
  orgId: string;
  save: ReturnType<typeof useServerFn<typeof upsertSupplier>>;
  onSaved: () => void;
}) {
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [category, setCategory] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editing) {
      setLegalName(editing.legal_name);
      setTradeName(editing.trade_name ?? "");
      setDocument(editing.document ?? "");
      setEmail(editing.email ?? "");
      setPhone(editing.phone ?? "");
      setContactName(editing.contact_name ?? "");
      setCategory(editing.category ?? "");
      setPaymentTerms(editing.payment_terms ?? "");
      setWebsite(editing.website ?? "");
      setAddress(editing.address ?? "");
      setIsActive(editing.is_active);
      setNotes(editing.notes ?? "");
    }
  }, [editing]);

  const submit = async () => {
    if (!legalName.trim()) { toast.error("Razão social obrigatória"); return; }
    setLoading(true);
    try {
      await save({
        data: {
          id: editing?.id,
          organization_id: orgId,
          legal_name: legalName,
          trade_name: tradeName, document, email, phone,
          contact_name: contactName, category, payment_terms: paymentTerms,
          website, address, notes, is_active: isActive,
        },
      });
      toast.success(editing ? "Fornecedor atualizado" : "Fornecedor criado");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Razão social *</Label>
              <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
            <div>
              <Label>Nome fantasia</Label>
              <Input value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
            </div>
            <div>
              <Label>CNPJ / Documento</Label>
              <Input value={document} onChange={(e) => setDocument(e.target.value)} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Matéria-prima, serviços…" />
            </div>
            <div>
              <Label>Contato</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Site</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <Label>Prazo de pagamento</Label>
              <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="30/60/90 dias" />
            </div>
            <div className="flex items-end gap-2">
              <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="active" className="mb-1.5">Ativo</Label>
            </div>
          </div>
          <div>
            <Label>Endereço</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
