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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { Plus, Trash2, Phone, Mail, Users, FileText, CheckSquare } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/activities")({ component: ActivitiesPage });

const TYPES = [
  { id: "task", label: "Tarefa", icon: CheckSquare },
  { id: "call", label: "Ligação", icon: Phone },
  { id: "email", label: "Email", icon: Mail },
  { id: "meeting", label: "Reunião", icon: Users },
  { id: "note", label: "Nota", icon: FileText },
] as const;

function ActivitiesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");

  const { data: activities } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*, contacts(name), deals(title)")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-list-a"],
    queryFn: async () => (await supabase.from("contacts").select("id, name").order("name")).data ?? [],
  });

  const { data: deals } = useQuery({
    queryKey: ["deals-list-a"],
    queryFn: async () => (await supabase.from("deals").select("id, title").order("title")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const payload = {
        user_id: user!.id,
        type: (form.get("type") as any) || "task",
        title: String(form.get("title") || "").trim(),
        description: String(form.get("description") || "").trim() || null,
        due_date: (form.get("due_date") as string) || null,
        contact_id: (form.get("contact_id") as string) || null,
        deal_id: (form.get("deal_id") as string) || null,
      };
      if (!payload.title) throw new Error("Título é obrigatório");
      const { error } = await supabase.from("activities").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); setOpen(false); toast.success("Atividade criada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("activities").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); toast.success("Removida"); },
  });

  const filtered = (activities ?? []).filter((a) =>
    filter === "all" ? true : filter === "pending" ? !a.completed : a.completed
  );

  return (
    <div className="p-8">
      <PageHeader
        title="Atividades"
        subtitle="Tarefas, ligações, reuniões e notas"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova atividade</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova atividade</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select name="type" defaultValue="task">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Vencimento</Label><Input name="due_date" type="datetime-local" /></div>
                </div>
                <div className="space-y-1.5"><Label>Título *</Label><Input name="title" required maxLength={200} /></div>
                <div className="space-y-1.5"><Label>Descrição</Label><Textarea name="description" maxLength={1000} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Contato</Label>
                    <Select name="contact_id">
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{contacts?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Negócio</Label>
                    <Select name="deal_id">
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{deals?.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Criar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mt-6 mb-4 flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["pending", "done", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${filter === f ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            {f === "pending" ? "Pendentes" : f === "done" ? "Concluídas" : "Todas"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground">Nenhuma atividade.</Card>
        )}
        {filtered.map((a) => {
          const type = TYPES.find((t) => t.id === a.type)!;
          const Icon = type.icon;
          return (
            <Card key={a.id} className="flex items-center gap-3 p-4">
              <Checkbox checked={a.completed} onCheckedChange={(v) => toggle.mutate({ id: a.id, completed: !!v })} />
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`truncate text-sm font-medium ${a.completed ? "text-muted-foreground line-through" : ""}`}>{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {type.label}
                  {a.due_date && ` · ${new Date(a.due_date).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                  {(a.contacts as any)?.name && ` · ${(a.contacts as any).name}`}
                  {(a.deals as any)?.title && ` · ${(a.deals as any).title}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover?")) del.mutate(a.id); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
