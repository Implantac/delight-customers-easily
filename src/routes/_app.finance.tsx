import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { supabase } from "@/integrations/supabase/client";
import {
  getFinanceOverview, upsertInvoice, deleteInvoice, markInvoicePaid,
} from "@/lib/finance.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, DollarSign, AlertCircle, CheckCircle2, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/finance")({ component: FinancePage });

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const STATUS_LABEL: Record<string, string> = {
  open: "Em aberto", paid: "Pago", overdue: "Vencido", canceled: "Cancelado",
};
const STATUS_VARIANT: Record<string, any> = {
  open: "secondary", paid: "default", overdue: "destructive", canceled: "outline",
};

function FinancePage() {
  const { orgId } = useCurrentOrg();
  const fn = useServerFn(getFinanceOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["finance", orgId],
    enabled: !!orgId,
    queryFn: () => fn({ data: { organization_id: orgId! } }),
  });

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 md:grid-cols-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const { invoices, totals, buckets, topDebtors } = data;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Financeiro"
        subtitle="Aging de recebíveis, inadimplência e top devedores."
        action={<InvoiceDialog orgId={orgId!} />}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={DollarSign} label="Em aberto" value={fmt(totals.open)} />
        <Kpi icon={AlertCircle} label="Vencido" value={fmt(totals.overdue)} tone="rose" subtitle={`${totals.count_overdue} faturas`} />
        <Kpi icon={CheckCircle2} label="Recebido (30d)" value={fmt(totals.paid_30d)} tone="emerald" />
        <Kpi icon={DollarSign} label="Total a receber" value={fmt(totals.total_outstanding)} tone="primary" />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Aging de inadimplência</h3>
        {buckets.every((b) => b.count === 0) ? (
          <p className="text-sm text-muted-foreground">Nenhuma fatura vencida.</p>
        ) : (
          <div className="space-y-2">
            {buckets.map((b, i) => {
              const max = Math.max(...buckets.map((x) => x.amount), 1);
              const w = (b.amount / max) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium">{b.label}</span>
                    <span className="text-muted-foreground">{fmt(b.amount)} · {b.count} faturas</span>
                  </div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-rose-500" style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Top devedores</h3>
        {topDebtors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem devedores.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2 font-medium">Empresa</th>
                <th className="text-right py-2 font-medium">Faturas vencidas</th>
                <th className="text-right py-2 font-medium">Maior atraso</th>
                <th className="text-right py-2 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {topDebtors.map((d) => (
                <tr key={d.company_id} className="border-b last:border-0">
                  <td className="py-2">
                    <Link to="/companies/$id" params={{ id: d.company_id }} className="font-medium hover:underline">
                      {d.name}
                    </Link>
                  </td>
                  <td className="py-2 text-right">{d.count}</td>
                  <td className="py-2 text-right">{d.max_overdue}d</td>
                  <td className="py-2 text-right font-semibold text-rose-500">{fmt(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Todas as faturas</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma fatura. Clique em "Nova fatura" para começar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 font-medium">Número</th>
                  <th className="text-left py-2 font-medium">Empresa</th>
                  <th className="text-left py-2 font-medium">Vencimento</th>
                  <th className="text-right py-2 font-medium">Valor</th>
                  <th className="text-center py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => <InvoiceRow key={inv.id} inv={inv} orgId={orgId!} />)}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function InvoiceRow({ inv, orgId }: { inv: any; orgId: string }) {
  const qc = useQueryClient();
  const payFn = useServerFn(markInvoicePaid);
  const delFn = useServerFn(deleteInvoice);

  const pay = useMutation({
    mutationFn: () => payFn({ data: { id: inv.id } }),
    onSuccess: () => {
      toast.success("Fatura marcada como paga");
      qc.invalidateQueries({ queryKey: ["finance", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => delFn({ data: { id: inv.id } }),
    onSuccess: () => {
      toast.success("Fatura removida");
      qc.invalidateQueries({ queryKey: ["finance", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="py-2 font-mono text-xs">{inv.number ?? "—"}</td>
      <td className="py-2">{inv.company_name ?? "—"}</td>
      <td className="py-2">
        {new Date(inv.due_date).toLocaleDateString("pt-BR")}
        {inv.overdue_days > 0 && (
          <span className="ml-2 text-xs text-rose-500">+{inv.overdue_days}d</span>
        )}
      </td>
      <td className="py-2 text-right font-medium">{fmt(inv.amount)}</td>
      <td className="py-2 text-center">
        <Badge variant={STATUS_VARIANT[inv.effective_status]}>{STATUS_LABEL[inv.effective_status]}</Badge>
      </td>
      <td className="py-2 text-right">
        {inv.effective_status !== "paid" && inv.effective_status !== "canceled" && (
          <Button size="icon" variant="ghost" onClick={() => pay.mutate()} disabled={pay.isPending} title="Marcar como pago">
            <Check className="h-4 w-4 text-emerald-500" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
          <Trash2 className="h-4 w-4 text-rose-500" />
        </Button>
      </td>
    </tr>
  );
}

function InvoiceDialog({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const upsert = useServerFn(upsertInvoice);

  const { data: companies } = useQuery({
    queryKey: ["finance-companies", orgId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies").select("id, name").eq("organization_id", orgId).order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    number: "", amount: "", company_id: "__none__",
    issued_at: today, due_date: today, notes: "",
  });

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          organization_id: orgId,
          number: form.number || null,
          amount: Number(form.amount) || 0,
          company_id: form.company_id === "__none__" ? null : form.company_id,
          status: "open",
          issued_at: form.issued_at,
          due_date: form.due_date,
          notes: form.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Fatura criada");
      setOpen(false);
      setForm({ number: "", amount: "", company_id: "__none__", issued_at: today, due_date: today, notes: "" });
      qc.invalidateQueries({ queryKey: ["finance", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" />Nova fatura</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova fatura</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Número</Label>
              <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="NF-001" />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Empresa</Label>
            <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem empresa —</SelectItem>
                {companies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Emissão</Label>
              <Input type="date" value={form.issued_at} onChange={(e) => setForm({ ...form, issued_at: e.target.value })} />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!form.amount || !form.due_date || save.isPending}>
            Criar fatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ icon: Icon, label, value, tone, subtitle }: any) {
  const tones: Record<string, string> = {
    primary: "text-primary", emerald: "text-emerald-500", rose: "text-rose-500",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <p className={`mt-1 text-2xl font-bold ${tones[tone ?? ""] ?? "text-foreground"}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </Card>
  );
}
