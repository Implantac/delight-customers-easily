import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Clock, Plus, Trash2, Pencil, DollarSign, Timer, CheckCircle2, Receipt } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useCurrentOrg } from "@/lib/org";
import {
  listTimeEntries, upsertTimeEntry, deleteTimeEntry, markTimeEntriesBilled,
} from "@/lib/timetracking.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/time")({ component: TimeTrackingPage });

function emptyDraft() {
  return {
    entry_date: new Date().toISOString().slice(0, 10),
    hours: "1",
    minutes: "0",
    description: "",
    billable: true,
    hourly_rate: "0",
    deal_id: "",
    ticket_id: "",
    company_id: "",
    contact_id: "",
    tags: "",
  };
}

function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm.toString().padStart(2, "0")}m`;
}
function fmtMoney(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function TimeTrackingPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(listTimeEntries);
  const saveFn = useServerFn(upsertTimeEntry);
  const delFn = useServerFn(deleteTimeEntry);
  const billFn = useServerFn(markTimeEntriesBilled);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(firstOfMonth.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [filter, setFilter] = useState<"all" | "billable" | "non" | "billed" | "unbilled">("all");

  const [dlg, setDlg] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(emptyDraft());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["time-entries", orgId, from, to, filter],
    queryFn: () => listFn({ data: { organization_id: orgId!, from, to, billable: filter } }),
    enabled: !!orgId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["time-entries"] });

  const save = useMutation({
    mutationFn: async () => {
      const minutes = (parseInt(draft.hours || "0") * 60) + parseInt(draft.minutes || "0");
      return saveFn({
        data: {
          id: editId ?? undefined,
          organization_id: orgId!,
          entry_date: draft.entry_date,
          duration_minutes: minutes,
          description: draft.description || null,
          billable: draft.billable,
          hourly_rate: parseFloat(draft.hourly_rate) || 0,
          deal_id: draft.deal_id || null,
          ticket_id: draft.ticket_id || null,
          company_id: draft.company_id || null,
          contact_id: draft.contact_id || null,
          tags: draft.tags ? draft.tags.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        },
      });
    },
    onSuccess: () => { toast.success("Registro salvo"); setDlg(false); setDraft(emptyDraft()); setEditId(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const bill = useMutation({
    mutationFn: async (billed: boolean) => billFn({ data: { ids: Array.from(selected), billed } }),
    onSuccess: (res) => { toast.success(`${res.updated} registros atualizados`); setSelected(new Set()); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const entries = q.data?.entries ?? [];
  const totals = q.data?.totals ?? { entries: 0, total_minutes: 0, billable_minutes: 0, total_amount: 0, unbilled_amount: 0 };
  const byUser = q.data?.by_user ?? [];

  const toggleSelect = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const selectedAmount = useMemo(
    () => entries.filter((e: any) => selected.has(e.id)).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0),
    [entries, selected]
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="h-7 w-7" /> Apontamento de Horas
          </h1>
          <p className="text-muted-foreground mt-1">
            Registre tempo trabalhado por negócio, ticket ou cliente e gere valores faturáveis.
          </p>
        </div>
        <Button onClick={() => { setEditId(null); setDraft(emptyDraft()); setDlg(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo registro
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Timer className="h-4 w-4" /> Tempo total</div>
          <div className="text-2xl font-bold mt-1">{fmtMin(totals.total_minutes)}</div>
          <div className="text-xs text-muted-foreground">{totals.entries} registros</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Faturável</div>
          <div className="text-2xl font-bold mt-1">{fmtMin(totals.billable_minutes)}</div>
          <div className="text-xs text-muted-foreground">
            {totals.total_minutes > 0 ? Math.round((totals.billable_minutes / totals.total_minutes) * 100) : 0}% do total
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" /> Total a faturar</div>
          <div className="text-2xl font-bold mt-1">{fmtMoney(totals.total_amount)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Receipt className="h-4 w-4" /> Não faturado</div>
          <div className="text-2xl font-bold mt-1 text-orange-600">{fmtMoney(totals.unbilled_amount)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Filtro</Label>
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="billable">Apenas faturáveis</SelectItem>
                <SelectItem value="non">Não faturáveis</SelectItem>
                <SelectItem value="billed">Já faturados</SelectItem>
                <SelectItem value="unbilled">Pendentes de faturar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selected.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selected.size} selecionados ({fmtMoney(selectedAmount)})</span>
              <Button size="sm" variant="outline" onClick={() => bill.mutate(true)}>Marcar como faturado</Button>
              <Button size="sm" variant="outline" onClick={() => bill.mutate(false)}>Desfazer faturamento</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {byUser.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="font-medium mb-3">Por colaborador</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {byUser.map((u: any) => (
                <div key={u.user_id} className="border rounded p-3">
                  <div className="text-xs text-muted-foreground truncate">{u.user_id.slice(0, 8)}…</div>
                  <div className="font-medium">{fmtMin(u.minutes)}</div>
                  <div className="text-sm text-muted-foreground">{fmtMoney(u.amount)} · {u.count} registros</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : entries.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum registro no período.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {entries.map((e: any) => (
            <Card key={e.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleSelect(e.id)} />
                <div className="text-center w-20 shrink-0">
                  <div className="text-xs text-muted-foreground">{new Date(e.entry_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</div>
                  <div className="font-bold">{fmtMin(e.duration_minutes)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{e.description || "(sem descrição)"}</span>
                    {e.billable ? <Badge variant="default">Faturável</Badge> : <Badge variant="outline">Interno</Badge>}
                    {e.billed && <Badge variant="secondary">Faturado</Badge>}
                    {(e.tags ?? []).map((t: string) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {e.hourly_rate > 0 && `${fmtMoney(Number(e.hourly_rate))}/h · `}
                    {e.deal_id && "Negócio · "}
                    {e.ticket_id && "Ticket · "}
                    Por {e.user_id.slice(0, 8)}…
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{fmtMoney(Number(e.amount ?? 0))}</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => {
                    setEditId(e.id);
                    setDraft({
                      entry_date: e.entry_date,
                      hours: String(Math.floor(e.duration_minutes / 60)),
                      minutes: String(e.duration_minutes % 60),
                      description: e.description ?? "",
                      billable: e.billable,
                      hourly_rate: String(e.hourly_rate ?? 0),
                      deal_id: e.deal_id ?? "",
                      ticket_id: e.ticket_id ?? "",
                      company_id: e.company_id ?? "",
                      contact_id: e.contact_id ?? "",
                      tags: (e.tags ?? []).join(", "),
                    });
                    setDlg(true);
                  }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir registro?")) remove.mutate(e.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar apontamento" : "Novo apontamento"}</DialogTitle>
            <DialogDescription>Registre o tempo trabalhado em uma atividade.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={draft.entry_date} onChange={(e) => setDraft({ ...draft, entry_date: e.target.value })} />
              </div>
              <div>
                <Label>Horas</Label>
                <Input type="number" min="0" value={draft.hours} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} />
              </div>
              <div>
                <Label>Minutos</Label>
                <Input type="number" min="0" max="59" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>O que foi feito?</Label>
              <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 pt-6">
                <Checkbox checked={draft.billable} onCheckedChange={(c) => setDraft({ ...draft, billable: !!c })} />
                <Label>Faturável</Label>
              </div>
              <div>
                <Label>Valor por hora (R$)</Label>
                <Input type="number" step="0.01" value={draft.hourly_rate} onChange={(e) => setDraft({ ...draft, hourly_rate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ID do negócio (opcional)</Label>
                <Input value={draft.deal_id} onChange={(e) => setDraft({ ...draft, deal_id: e.target.value })} />
              </div>
              <div>
                <Label>ID do ticket (opcional)</Label>
                <Input value={draft.ticket_id} onChange={(e) => setDraft({ ...draft, ticket_id: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
