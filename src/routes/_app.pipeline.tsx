import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data: deals } = useQuery({
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
      const value = parseFloat(String(form.get("value") || "0").replace(",", "."));
      const payload = {
        user_id: user!.id,
        title: String(form.get("title") || "").trim(),
        value: isNaN(value) ? 0 : value,
        stage: (form.get("stage") as Stage) || "lead",
        contact_id: (form.get("contact_id") as string) || null,
        company_id: (form.get("company_id") as string) || null,
        expected_close: (form.get("expected_close") as string) || null,
        notes: String(form.get("notes") || "").trim() || null,
      };
      if (!payload.title) throw new Error("Título é obrigatório");
      const { error } = await supabase.from("deals").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); setOpen(false); toast.success("Negócio criado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); toast.success("Removido"); },
  });

  return (
    <div className="p-8">
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

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stage) => {
          const items = (deals ?? []).filter((d) => d.stage === stage.id);
          const sum = items.reduce((s, d) => s + Number(d.value), 0);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId) { move.mutate({ id: dragId, stage: stage.id }); setDragId(null); } }}
              className="flex flex-col rounded-lg bg-muted/40 p-2"
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
                    className={`cursor-grab border-l-4 p-3 active:cursor-grabbing ${stage.color}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-medium leading-tight">{d.title}</h4>
                      <button onClick={() => { if (confirm("Remover?")) del.mutate(d.id); }} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
    </div>
  );
}
