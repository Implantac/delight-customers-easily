import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Repeat, Plus, Pencil, Trash2, RefreshCw, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import {
  listSubscriptions, upsertSubscription, deleteSubscription, renewSubscription,
} from "@/lib/subscriptions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/subscriptions")({ component: SubsPage });

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa", cancelled: "Cancelada", paused: "Pausada", expired: "Expirada",
};

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default", cancelled: "destructive", paused: "outline", expired: "secondary",
};

const CYCLE_LABEL: Record<string, string> = {
  monthly: "Mensal", quarterly: "Trimestral", yearly: "Anual",
};

const fmtBRL = (v: number, c: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: c || "BRL" }).format(v);

function emptyDraft() {
  const today = new Date().toISOString().slice(0, 10);
  const renew = new Date();
  renew.setMonth(renew.getMonth() + 1);
  return {
    plan_name: "",
    mrr: 0,
    currency: "BRL",
    billing_cycle: "monthly" as const,
    start_date: today,
    renewal_date: renew.toISOString().slice(0, 10),
    status: "active" as const,
    notes: "",
    company_id: null as string | null,
    contact_id: null as string | null,
  };
}

function SubsPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const canManage = useCanManage();
  const fetchSubs = useServerFn(listSubscriptions);
  const upsertFn = useServerFn(upsertSubscription);
  const delFn = useServerFn(deleteSubscription);
  const renewFn = useServerFn(renewSubscription);

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "cancelled" | "paused" | "expired">("all");
  const [dialog, setDialog] = useState(false);
  const [draft, setDraft] = useState<any>({ ...emptyDraft() });

  const { data, isLoading } = useQuery({
    queryKey: ["subscriptions", orgId, statusFilter],
    queryFn: () => fetchSubs({ data: { organization_id: orgId!, status: statusFilter } }),
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
          plan_name: draft.plan_name.trim(),
          mrr: Number(draft.mrr),
          currency: draft.currency,
          billing_cycle: draft.billing_cycle,
          start_date: draft.start_date,
          renewal_date: draft.renewal_date,
          status: draft.status,
          notes: draft.notes?.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Assinatura salva");
      setDialog(false);
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Excluída");
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renew = useMutation({
    mutationFn: (id: string) => renewFn({ data: { id } }),
    onSuccess: (r: any) => {
      toast.success(`Renovada até ${new Date(r.renewal_date).toLocaleDateString("pt-BR")}`);
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const today = useMemo(() => new Date(), []);

  const openNew = () => { setDraft({ ...emptyDraft() }); setDialog(true); };
  const openEdit = (s: any) => {
    setDraft({
      id: s.id,
      plan_name: s.plan_name,
      mrr: s.mrr,
      currency: s.currency,
      billing_cycle: s.billing_cycle,
      start_date: s.start_date,
      renewal_date: s.renewal_date,
      status: s.status,
      notes: s.notes ?? "",
      company_id: s.company_id,
      contact_id: s.contact_id,
    });
    setDialog(true);
  };

  const kpis = data?.kpis ?? { mrr: 0, arr: 0, count: 0, renewingSoon: 0, overdue: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Repeat className="h-6 w-6" /> Assinaturas
          </h1>
          <p className="text-sm text-muted-foreground">Receita recorrente, MRR e renovações.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova assinatura</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> MRR</p>
          <p className="text-2xl font-bold">{fmtBRL(kpis.mrr, "BRL")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> ARR</p>
          <p className="text-2xl font-bold">{fmtBRL(kpis.arr, "BRL")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Ativas</p>
          <p className="text-2xl font-bold">{kpis.count}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Renovam em 30d</p>
          <p className="text-2xl font-bold">{kpis.renewingSoon}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" /> Vencidas
          </p>
          <p className="text-2xl font-bold text-destructive">{kpis.overdue}</p>
        </CardContent></Card>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="active">Ativas</TabsTrigger>
          <TabsTrigger value="paused">Pausadas</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
          <TabsTrigger value="expired">Expiradas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (data?.subscriptions ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
            <Repeat className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhuma assinatura nesta categoria.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {(data?.subscriptions ?? []).map((s) => {
                const rDate = new Date(s.renewal_date);
                const isOverdue = rDate < today && s.status === "active";
                const daysToRenewal = Math.ceil((rDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{s.plan_name}</p>
                        <Badge variant={STATUS_BADGE[s.status]} className="text-[10px]">{STATUS_LABEL[s.status]}</Badge>
                        <Badge variant="outline" className="text-[10px]">{CYCLE_LABEL[s.billing_cycle]}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.companies?.name ?? (s.contacts ? `${s.contacts.first_name ?? ""} ${s.contacts.last_name ?? ""}`.trim() : "—")}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">{fmtBRL(Number(s.mrr), s.currency)}</p>
                      <p className={`text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {isOverdue ? "Vencida" : `Renova em ${daysToRenewal}d`} · {rDate.toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => renew.mutate(s.id)} title="Renovar">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canManage && (
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm("Excluir assinatura?")) remove.mutate(s.id); }}>
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
          <DialogHeader><DialogTitle>{draft.id ? "Editar assinatura" : "Nova assinatura"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome do plano</Label>
              <Input value={draft.plan_name} onChange={(e) => setDraft({ ...draft, plan_name: e.target.value })} />
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
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Valor</Label>
                <Input type="number" min={0} step="0.01"
                  value={draft.mrr} onChange={(e) => setDraft({ ...draft, mrr: e.target.value })} />
              </div>
              <div>
                <Label>Moeda</Label>
                <Input value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} />
              </div>
              <div>
                <Label>Ciclo</Label>
                <Select value={draft.billing_cycle} onValueChange={(v) => setDraft({ ...draft, billing_cycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CYCLE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Início</Label>
                <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
              </div>
              <div>
                <Label>Renovação</Label>
                <Input type="date" value={draft.renewal_date} onChange={(e) => setDraft({ ...draft, renewal_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button disabled={!draft.plan_name?.trim() || upsert.isPending} onClick={() => upsert.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
