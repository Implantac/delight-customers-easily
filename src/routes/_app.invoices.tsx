import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FileText, Plus, Pencil, Trash2, CheckCircle2, AlertTriangle, DollarSign, Receipt } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { listInvoices, upsertInvoice, deleteInvoice, markInvoicePaid } from "@/lib/invoices.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/invoices")({ component: InvoicesPage });

const STATUS_LABEL: Record<string, string> = {
  open: "Em aberto", paid: "Paga", overdue: "Vencida", void: "Cancelada",
};
const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "outline", paid: "default", overdue: "destructive", void: "secondary",
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function emptyDraft() {
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date();
  due.setDate(due.getDate() + 14);
  return {
    number: "",
    amount: 0,
    status: "open" as const,
    issued_at: today,
    due_date: due.toISOString().slice(0, 10),
    paid_at: null as string | null,
    notes: "",
    company_id: null as string | null,
    contact_id: null as string | null,
    deal_id: null as string | null,
  };
}

function InvoicesPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const canManage = useCanManage();
  const fetchFn = useServerFn(listInvoices);
  const upsertFn = useServerFn(upsertInvoice);
  const delFn = useServerFn(deleteInvoice);
  const paidFn = useServerFn(markInvoicePaid);

  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "paid" | "overdue" | "void">("all");
  const [dialog, setDialog] = useState(false);
  const [draft, setDraft] = useState<any>({ ...emptyDraft() });

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", orgId, statusFilter],
    queryFn: () => fetchFn({ data: { organization_id: orgId!, status: statusFilter } }),
    enabled: !!orgId,
  });

  const { data: companies } = useQuery({
    queryKey: ["companies-min", orgId],
    enabled: !!orgId && dialog,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies").select("id, name").eq("organization_id", orgId!).order("name").limit(500);
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: draft.id,
          organization_id: orgId!,
          company_id: draft.company_id,
          contact_id: draft.contact_id,
          deal_id: draft.deal_id,
          number: draft.number?.trim() || null,
          amount: Number(draft.amount),
          status: draft.status,
          issued_at: draft.issued_at,
          due_date: draft.due_date,
          paid_at: draft.status === "paid" ? (draft.paid_at || new Date().toISOString().slice(0, 10)) : null,
          notes: draft.notes?.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Fatura salva");
      setDialog(false);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluída"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: (id: string) => paidFn({ data: { id } }),
    onSuccess: () => { toast.success("Marcada como paga"); qc.invalidateQueries({ queryKey: ["invoices"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);

  const openNew = () => { setDraft({ ...emptyDraft() }); setDialog(true); };
  const openEdit = (inv: any) => {
    setDraft({
      id: inv.id,
      number: inv.number ?? "",
      amount: inv.amount,
      status: inv.status,
      issued_at: inv.issued_at,
      due_date: inv.due_date,
      paid_at: inv.paid_at,
      notes: inv.notes ?? "",
      company_id: inv.company_id,
      contact_id: inv.contact_id,
      deal_id: inv.deal_id,
    });
    setDialog(true);
  };

  const kpis = data?.kpis ?? { billed: 0, paid: 0, openAmt: 0, overdueAmt: 0, overdueCount: 0, count: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6" /> Faturas
          </h1>
          <p className="text-sm text-muted-foreground">Cobrança, recebimentos e inadimplência.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova fatura</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Faturado</p>
          <p className="text-2xl font-bold">{fmtBRL(kpis.billed)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Recebido</p>
          <p className="text-2xl font-bold">{fmtBRL(kpis.paid)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Em aberto</p>
          <p className="text-2xl font-bold">{fmtBRL(kpis.openAmt)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" /> Vencido ({kpis.overdueCount})
          </p>
          <p className="text-2xl font-bold text-destructive">{fmtBRL(kpis.overdueAmt)}</p>
        </CardContent></Card>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="open">Em aberto</TabsTrigger>
          <TabsTrigger value="overdue">Vencidas</TabsTrigger>
          <TabsTrigger value="paid">Pagas</TabsTrigger>
          <TabsTrigger value="void">Canceladas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (data?.invoices ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma fatura nesta categoria.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {(data?.invoices ?? []).map((inv: any) => {
                const isOverdue = inv.status === "open" && inv.due_date < today;
                const effStatus = isOverdue ? "overdue" : inv.status;
                return (
                  <div key={inv.id} className="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">
                          {inv.number || `#${inv.id.slice(0, 8)}`}
                        </p>
                        <Badge variant={STATUS_BADGE[effStatus]} className="text-[10px]">
                          {STATUS_LABEL[effStatus]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {inv.companies?.name ?? "—"} · Vence {new Date(inv.due_date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{fmtBRL(Number(inv.amount))}</p>
                      {inv.paid_at && (
                        <p className="text-xs text-muted-foreground">
                          Paga em {new Date(inv.paid_at).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {inv.status !== "paid" && inv.status !== "void" && (
                        <Button variant="ghost" size="sm" onClick={() => markPaid.mutate(inv.id)} title="Marcar como paga">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(inv)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canManage && (
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("Excluir fatura?")) remove.mutate(inv.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{draft.id ? "Editar fatura" : "Nova fatura"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Número</Label>
                <Input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} placeholder="INV-001" />
              </div>
              <div>
                <Label>Valor</Label>
                <Input type="number" min={0} step="0.01"
                  value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Empresa</Label>
              <Select
                value={draft.company_id ?? "__none__"}
                onValueChange={(v) => setDraft({ ...draft, company_id: v === "__none__" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Sem empresa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Nenhuma —</SelectItem>
                  {(companies ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Emissão</Label>
                <Input type="date" value={draft.issued_at} onChange={(e) => setDraft({ ...draft, issued_at: e.target.value })} />
              </div>
              <div>
                <Label>Vencimento</Label>
                <Input type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Status</Label>
                <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {draft.status === "paid" && (
                <div>
                  <Label>Pago em</Label>
                  <Input type="date" value={draft.paid_at ?? ""} onChange={(e) => setDraft({ ...draft, paid_at: e.target.value })} />
                </div>
              )}
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button disabled={Number(draft.amount) <= 0 || upsert.isPending} onClick={() => upsert.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
