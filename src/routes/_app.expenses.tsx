import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Wallet, Plus, Pencil, Trash2, Check, X, Banknote } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { useAuth } from "@/lib/auth";
import { listExpenses, upsertExpense, decideExpense, deleteExpense } from "@/lib/expenses.functions";
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
import { ErpReadOnlyBanner } from "@/components/erp-readonly-banner";

export const Route = createFileRoute("/_app/expenses")({ component: ExpensesPage });

const CATEGORY_LABEL: Record<string, string> = {
  travel: "Viagem", meals: "Refeição", lodging: "Hospedagem", software: "Software",
  marketing: "Marketing", supplies: "Material", other: "Outro",
};
const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro", credit_card: "Cartão crédito", debit_card: "Cartão débito",
  transfer: "Transferência", pix: "PIX", other: "Outro",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", approved: "Aprovada", reimbursed: "Reembolsada", rejected: "Rejeitada",
};
const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline", approved: "default", reimbursed: "secondary", rejected: "destructive",
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function emptyDraft() {
  return {
    category: "other" as const,
    description: "",
    amount: 0,
    currency: "BRL",
    expense_date: new Date().toISOString().slice(0, 10),
    payment_method: "credit_card" as const,
    company_id: null as string | null,
    receipt_url: "",
    notes: "",
  };
}

function ExpensesPage() {
  const { orgId } = useCurrentOrg();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManage = useCanManage();
  const fetchFn = useServerFn(listExpenses);
  const upsertFn = useServerFn(upsertExpense);
  const decideFn = useServerFn(decideExpense);
  const delFn = useServerFn(deleteExpense);

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "reimbursed" | "rejected">("pending");
  const [scope, setScope] = useState<"all" | "mine">("mine");
  const [dialog, setDialog] = useState(false);
  const [draft, setDraft] = useState<any>({ ...emptyDraft() });

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", orgId, statusFilter, scope],
    queryFn: () => fetchFn({ data: { organization_id: orgId!, status: statusFilter, scope } }),
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
          category: draft.category,
          description: draft.description.trim(),
          amount: Number(draft.amount),
          currency: draft.currency || "BRL",
          expense_date: draft.expense_date,
          payment_method: draft.payment_method || null,
          company_id: draft.company_id,
          deal_id: null,
          receipt_url: draft.receipt_url?.trim() || null,
          notes: draft.notes?.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Despesa salva");
      setDialog(false);
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" | "reimbursed" }) => decideFn({ data: v }),
    onSuccess: () => { toast.success("Atualizada"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluída"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setDraft({ ...emptyDraft() }); setDialog(true); };
  const openEdit = (e: any) => {
    setDraft({
      id: e.id,
      category: e.category,
      description: e.description,
      amount: e.amount,
      currency: e.currency,
      expense_date: e.expense_date,
      payment_method: e.payment_method ?? "credit_card",
      company_id: e.company_id,
      receipt_url: e.receipt_url ?? "",
      notes: e.notes ?? "",
    });
    setDialog(true);
  };

  const totals = data?.totals ?? { pending: 0, approved: 0, reimbursed: 0, rejected: 0, all: 0 };

  return (
    <div className="space-y-6">
      <ErpReadOnlyBanner entity="Despesas" />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Despesas
          </h1>
          <p className="text-sm text-muted-foreground">Reembolsos, despesas operacionais e gastos por categoria.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova despesa</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold">{fmtBRL(totals.pending)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Aprovadas</p>
          <p className="text-2xl font-bold">{fmtBRL(totals.approved)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Banknote className="h-3 w-3" /> Reembolsadas</p>
          <p className="text-2xl font-bold">{fmtBRL(totals.reimbursed)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total filtrado</p>
          <p className="text-2xl font-bold">{fmtBRL(totals.all)}</p>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="approved">Aprovadas</TabsTrigger>
            <TabsTrigger value="reimbursed">Reembolsadas</TabsTrigger>
            <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        {canManage && (
          <Tabs value={scope} onValueChange={(v) => setScope(v as any)}>
            <TabsList>
              <TabsTrigger value="mine">Minhas</TabsTrigger>
              <TabsTrigger value="all">Da equipe</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (data?.expenses ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <Wallet className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma despesa nesta categoria.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {(data?.expenses ?? []).map((e) => {
                const isMine = e.user_id === user?.id;
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{e.description}</p>
                        <Badge variant={STATUS_BADGE[e.status]} className="text-[10px]">{STATUS_LABEL[e.status]}</Badge>
                        <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[e.category] ?? e.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.expense_date).toLocaleDateString("pt-BR")}
                        {e.payment_method && ` · ${METHOD_LABEL[e.payment_method] ?? e.payment_method}`}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{fmtBRL(Number(e.amount))}</p>
                      {e.receipt_url && (
                        <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                          Recibo
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {e.status === "pending" && canManage && (
                        <>
                          <Button size="sm" variant="ghost" title="Aprovar" onClick={() => decide.mutate({ id: e.id, status: "approved" })}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" title="Rejeitar" onClick={() => decide.mutate({ id: e.id, status: "rejected" })}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {e.status === "approved" && canManage && (
                        <Button size="sm" variant="ghost" title="Marcar reembolsada" onClick={() => decide.mutate({ id: e.id, status: "reimbursed" })}>
                          <Banknote className="h-4 w-4" />
                        </Button>
                      )}
                      {(isMine && e.status === "pending") || canManage ? (
                        <Button size="sm" variant="ghost" onClick={() => openEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir despesa?")) remove.mutate(e.id); }}>
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
          <DialogHeader><DialogTitle>{draft.id ? "Editar despesa" : "Nova despesa"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descrição</Label>
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Categoria</Label>
                <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select value={draft.payment_method} onValueChange={(v) => setDraft({ ...draft, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Valor</Label>
                <Input type="number" min={0} step="0.01"
                  value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              </div>
              <div>
                <Label>Moeda</Label>
                <Input value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={draft.expense_date} onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Empresa relacionada (opcional)</Label>
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
            <div>
              <Label>URL do recibo (opcional)</Label>
              <Input value={draft.receipt_url} onChange={(e) => setDraft({ ...draft, receipt_url: e.target.value })}
                placeholder="https://..." />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button disabled={!draft.description?.trim() || Number(draft.amount) <= 0 || upsert.isPending}
              onClick={() => upsert.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
