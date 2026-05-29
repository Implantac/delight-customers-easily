import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import { dealSchema, fromForm } from "@/lib/validation";
import { AIInsights } from "@/components/ai-insights";
import { Attachments } from "@/components/attachments";
import { TagPicker } from "@/components/tag-picker";
import { DealHistory } from "@/components/deal-history";
import { useServerFn } from "@tanstack/react-start";
import { triggerWebhooks } from "@/lib/webhooks.functions";
import { runAutomations } from "@/lib/automations.functions";

export const Route = createFileRoute("/_app/pipeline")({ component: PipelinePage });

const STAGES = [
  { id: "lead", label: "Lead", color: "border-l-slate-400" },
  { id: "qualified", label: "Qualificado", color: "border-l-blue-500" },
  { id: "proposal", label: "Proposta", color: "border-l-violet-500" },
  { id: "negotiation", label: "Negociação", color: "border-l-amber-500" },
  { id: "won", label: "Ganho", color: "border-l-emerald-500" },
  { id: "lost", label: "Perdido", color: "border-l-rose-500" },
] as const;

type Stage = typeof STAGES[number]["id"];
const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function PipelinePage() {
  const { user } = useAuth();
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: deals, isLoading } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*, contacts(name), companies(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-list"],
    queryFn: async () => (await supabase.from("contacts").select("id, name, company_id").order("name")).data ?? [],
  });

  const { data: companies } = useQuery({
    queryKey: ["companies-list-p"],
    queryFn: async () => (await supabase.from("companies").select("id, name").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      if (!orgId) throw new Error("Nenhuma organização ativa");
      const parsed = fromForm(dealSchema, form);
      const { error } = await supabase.from("deals").insert({
        user_id: user!.id,
        organization_id: orgId,
        ...parsed,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); setOpen(false); toast.success("Negócio criado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const fire = useServerFn(triggerWebhooks);

  const move = useMutation({
    mutationFn: async ({ id, stage, prevStage, deal }: { id: string; stage: Stage; prevStage: Stage; deal: any }) => {
      const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
      if (error) throw error;
      if (prevStage !== stage && orgId) {
        const events = ["deal.stage_changed"];
        if (stage === "won") events.push("deal.won");
        if (stage === "lost") events.push("deal.lost");
        for (const ev of events) {
          fire({ data: { organization_id: orgId, event: ev, payload: { id, from: prevStage, to: stage, deal } } }).catch(() => {});
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); toast.success("Removido"); setSelectedId(null); },
  });

  const selected = (deals ?? []).find((d) => d.id === selectedId) ?? null;

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title="Pipeline"
        subtitle={`${deals?.length ?? 0} negócios · ${fmtBRL((deals ?? []).reduce((s, d) => s + Number(d.value), 0))} total`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo negócio</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo negócio</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
                <div className="space-y-1.5"><Label>Título *</Label><Input name="title" required maxLength={150} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Valor (R$)</Label><Input name="value" type="number" step="0.01" defaultValue="0" /></div>
                  <div className="space-y-1.5">
                    <Label>Estágio</Label>
                    <Select name="stage" defaultValue="lead">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Contato</Label>
                    <Select name="contact_id">
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{contacts?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Empresa</Label>
                    <Select name="company_id">
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{companies?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>Fechamento previsto</Label><Input name="expected_close" type="date" /></div>
                <div className="space-y-1.5"><Label>Notas</Label><Textarea name="notes" maxLength={1000} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Criar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((s) => <Skeleton key={s.id} className="h-64 w-full" />)}
        </div>
      ) : (deals ?? []).length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={Target} title="Sem negócios" description="Crie seu primeiro negócio para começar a acompanhar o funil." />
        </div>
      ) : (
        <div className="mt-6 flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible lg:grid-cols-6">
          {STAGES.map((stage) => {
            const items = (deals ?? []).filter((d) => d.stage === stage.id);
            const sum = items.reduce((s, d) => s + Number(d.value), 0);
            return (
              <div
                key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (!dragId) return;
                  const d = (deals ?? []).find((x) => x.id === dragId);
                  if (d && d.stage !== stage.id) move.mutate({ id: dragId, stage: stage.id, prevStage: d.stage as Stage, deal: { title: d.title, value: d.value } });
                  setDragId(null);
                }}
                className="flex w-[80vw] shrink-0 flex-col rounded-lg bg-muted/40 p-2 md:w-auto md:shrink"
              >
                <div className="px-2 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{stage.label}</span>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{fmtBRL(sum)}</p>
                </div>
                <div className="flex-1 space-y-2">
                  {items.map((d) => (
                    <Card
                      key={d.id}
                      draggable
                      onDragStart={() => setDragId(d.id)}
                      onClick={() => setSelectedId(d.id)}
                      className={`cursor-grab border-l-4 p-3 transition hover:shadow-md active:cursor-grabbing ${stage.color}`}
                    >
                      <h4 className="text-sm font-medium leading-tight">{d.title}</h4>
                      <p className="mt-1 text-sm font-semibold text-primary">{fmtBRL(Number(d.value))}</p>
                      {((d.contacts as any)?.name || (d.companies as any)?.name) && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {(d.contacts as any)?.name}{(d.contacts as any)?.name && (d.companies as any)?.name ? " · " : ""}{(d.companies as any)?.name}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DealDrawer
        deal={selected}
        contacts={contacts ?? []}
        companies={companies ?? []}
        onClose={() => setSelectedId(null)}
        onDelete={(id) => { if (confirm("Remover este negócio?")) del.mutate(id); }}
      />
    </div>
  );
}

function DealDrawer({
  deal, contacts, companies, onClose, onDelete,
}: {
  deal: any | null;
  contacts: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (deal) setForm({
      title: deal.title,
      value: deal.value,
      stage: deal.stage,
      contact_id: deal.contact_id ?? "",
      company_id: deal.company_id ?? "",
      expected_close: deal.expected_close ?? "",
      notes: deal.notes ?? "",
    });
  }, [deal?.id]);

  const { data: activities } = useQuery({
    queryKey: ["deal-activities", deal?.id],
    enabled: !!deal?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, type, title, completed, due_date")
        .eq("deal_id", deal!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!deal) return;
      const parsed = dealSchema.parse({
        ...form,
        contact_id: form.contact_id || undefined,
        company_id: form.company_id || undefined,
        expected_close: form.expected_close || undefined,
        notes: form.notes || undefined,
      });
      const { error } = await supabase.from("deals").update(parsed).eq("id", deal.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); toast.success("Negócio atualizado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={!!deal} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar negócio</SheetTitle>
        </SheetHeader>
        {form && deal && (
          <div className="mt-6 space-y-4">
            <div className="space-y-1.5"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={150} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Estágio</Label>
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contato</Label>
                <Select value={form.contact_id || "_none"} onValueChange={(v) => setForm({ ...form, contact_id: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Empresa</Label>
                <Select value={form.company_id || "_none"} onValueChange={(v) => setForm({ ...form, company_id: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Fechamento</Label><Input type="date" value={form.expected_close} onChange={(e) => setForm({ ...form, expected_close: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} rows={4} /></div>

            <div className="border-t pt-4">
              <h4 className="mb-2 text-sm font-semibold">Atividades vinculadas</h4>
              {!activities?.length ? (
                <p className="text-xs text-muted-foreground">Nenhuma atividade ainda.</p>
              ) : (
                <ul className="space-y-1.5">
                  {activities.map((a: any) => (
                    <li key={a.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <span className={a.completed ? "text-muted-foreground line-through" : ""}>{a.title}</span>
                      <span className="text-xs text-muted-foreground">{a.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <AIInsights dealId={deal.id} actions={["score_deal"]} />

            <div className="border-t pt-4">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Etiquetas</p>
              <TagPicker entityType="deal" entityId={deal.id} />
            </div>

            <Attachments entityType="deal" entityId={deal.id} />

            <DealHistory dealId={deal.id} />



            <SheetFooter className="gap-2 sm:gap-2">
              <Button variant="destructive" size="sm" onClick={() => onDelete(deal.id)}>
                <Trash2 className="mr-1 h-4 w-4" /> Remover
              </Button>
              <Button onClick={() => update.mutate()} disabled={update.isPending}>Salvar</Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
