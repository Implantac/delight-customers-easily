import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { listBanking, upsertAccount, upsertTx, toggleReconciled, deleteTx, type BankAccount } from "@/lib/banking.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Landmark, Plus, ArrowUpRight, ArrowDownRight, CheckCircle2, Circle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/banking")({ component: BankingPage });

const fmt = (v: number, c = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(v || 0);

function BankingPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const list = useServerFn(listBanking);
  const saveAcc = useServerFn(upsertAccount);
  const saveTx = useServerFn(upsertTx);
  const toggle = useServerFn(toggleReconciled);
  const del = useServerFn(deleteTx);

  const [accFilter, setAccFilter] = useState<string>("all");
  const [recFilter, setRecFilter] = useState<"all" | "yes" | "no">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["banking", orgId, accFilter, recFilter],
    queryFn: () => list({
      data: {
        organization_id: orgId!,
        account_id: accFilter !== "all" ? accFilter : undefined,
        reconciled: recFilter,
      },
    }),
    enabled: !!orgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["banking", orgId] });

  const mAcc = useMutation({
    mutationFn: (v: any) => saveAcc({ data: v }),
    onSuccess: () => { toast.success("Conta salva"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mTx = useMutation({
    mutationFn: (v: any) => saveTx({ data: v }),
    onSuccess: () => { toast.success("Lançamento salvo"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });
  const mToggle = useMutation({
    mutationFn: (v: any) => toggle({ data: v }),
    onSuccess: () => invalidate(),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); invalidate(); },
  });

  const accounts = data?.accounts ?? [];
  const txs = data?.transactions ?? [];
  const totals = data?.totals;
  const balances = data?.balances ?? {};

  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-7 w-7 text-primary" /> Conciliação Bancária
          </h1>
          <p className="text-muted-foreground">Contas, movimentações e conciliação com faturas e despesas.</p>
        </div>
        <div className="flex gap-2">
          <AccountDialog onSave={(v) => mAcc.mutate({ ...v, organization_id: orgId! })} />
          <TxDialog accounts={accounts} onSave={(v) => mTx.mutate({ ...v, organization_id: orgId! })} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saldo total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmt(totals?.total_balance ?? 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Entradas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-600">{fmt(totals?.total_inflow ?? 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Saídas</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-rose-600">{fmt(totals?.total_outflow ?? 0)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pendentes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totals?.unreconciled ?? 0}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="tx">
        <TabsList>
          <TabsTrigger value="tx">Movimentações</TabsTrigger>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
        </TabsList>

        <TabsContent value="tx" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Select value={accFilter} onValueChange={setAccFilter}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={recFilter} onValueChange={(v) => setRecFilter(v as any)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="no">Não conciliadas</SelectItem>
                <SelectItem value="yes">Conciliadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-6 text-muted-foreground">Carregando…</p>
              ) : txs.length === 0 ? (
                <p className="p-6 text-muted-foreground text-center">Nenhum lançamento.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txs.map((t) => {
                      const acc = accMap.get(t.account_id);
                      const isIn = Number(t.amount) >= 0;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm">{t.occurred_at}</TableCell>
                          <TableCell>
                            <div className="font-medium">{t.description}</div>
                            {t.counterparty && <div className="text-xs text-muted-foreground">{t.counterparty}</div>}
                          </TableCell>
                          <TableCell className="text-sm">{acc?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.category ?? "—"}</TableCell>
                          <TableCell className={`text-right font-medium ${isIn ? "text-emerald-600" : "text-rose-600"}`}>
                            <span className="inline-flex items-center gap-1 justify-end">
                              {isIn ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {fmt(Math.abs(Number(t.amount)), acc?.currency ?? "BRL")}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant={t.reconciled ? "default" : "outline"}
                              onClick={() => mToggle.mutate({ id: t.id, reconciled: !t.reconciled })}
                            >
                              {t.reconciled ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Circle className="h-3 w-3 mr-1" />}
                              {t.reconciled ? "Conciliado" : "Pendente"}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => mDel.mutate(t.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          {accounts.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">
              Cadastre sua primeira conta bancária.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((a) => {
                const b = balances[a.id] ?? { balance: 0, inflow: 0, outflow: 0, pending: 0 };
                return (
                  <Card key={a.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{a.name}</CardTitle>
                        {!a.is_active && <Badge variant="secondary">Inativa</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{a.bank_name ?? "—"} · {a.account_number ?? "—"}</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-2xl font-bold">{fmt(b.balance, a.currency)}</p>
                      <div className="flex gap-3 text-xs">
                        <span className="text-emerald-600">↑ {fmt(b.inflow, a.currency)}</span>
                        <span className="text-rose-600">↓ {fmt(b.outflow, a.currency)}</span>
                        {b.pending > 0 && <span className="text-amber-600">{b.pending} pendentes</span>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccountDialog({ onSave }: { onSave: (v: any) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", bank_name: "", account_number: "", currency: "BRL", opening_balance: 0 });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Nova conta</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova conta bancária</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Banco</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
            <div><Label>Conta</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Moeda</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} /></div>
            <div><Label>Saldo inicial</Label><Input type="number" step="0.01" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => { if (!form.name) return; onSave(form); setOpen(false); setForm({ name: "", bank_name: "", account_number: "", currency: "BRL", opening_balance: 0 }); }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TxDialog({ accounts, onSave }: { accounts: BankAccount[]; onSave: (v: any) => void }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    account_id: "",
    occurred_at: today,
    description: "",
    amount: 0,
    type: "in" as "in" | "out",
    counterparty: "",
    category: "",
    notes: "",
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={accounts.length === 0}><Plus className="h-4 w-4 mr-2" />Lançamento</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Conta *</Label>
            <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data</Label><Input type="date" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada</SelectItem>
                  <SelectItem value="out">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Descrição *</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          </div>
          <div><Label>Contraparte</Label><Input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} /></div>
          <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => {
            if (!form.account_id || !form.description || !form.amount) return;
            const amt = form.type === "out" ? -Math.abs(form.amount) : Math.abs(form.amount);
            onSave({
              account_id: form.account_id,
              occurred_at: form.occurred_at,
              description: form.description,
              amount: amt,
              counterparty: form.counterparty || null,
              category: form.category || null,
              notes: form.notes || null,
            });
            setOpen(false);
            setForm({ ...form, description: "", amount: 0, counterparty: "", category: "", notes: "" });
          }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
