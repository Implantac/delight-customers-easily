import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCurrentOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Plus, Trash2, Phone, Mail, Users, FileText, CheckSquare, CalendarPlus, List, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { activitySchema, fromForm } from "@/lib/validation";
import { downloadICS } from "@/lib/ics";
import { useServerFn } from "@tanstack/react-start";
import { triggerWebhooks } from "@/lib/webhooks.functions";
import { runAutomations } from "@/lib/automations.functions";
import { SavedViews } from "@/components/saved-views";

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
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");
  const [view, setView] = useState<"list" | "agenda">("list");

  const { data: activities, isLoading } = useQuery({
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
      if (!orgId) throw new Error("Nenhuma organização ativa");
      const parsed = fromForm(activitySchema, form);
      const { error } = await supabase.from("activities").insert({
        user_id: user!.id,
        organization_id: orgId,
        ...parsed,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); setOpen(false); toast.success("Atividade criada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const fire = useServerFn(triggerWebhooks);

  const toggle = useMutation({
    mutationFn: async ({ id, completed, activity }: { id: string; completed: boolean; activity: any }) => {
      const { error } = await supabase.from("activities").update({ completed }).eq("id", id);
      if (error) throw error;
      if (completed && orgId) {
        fire({ data: { organization_id: orgId, event: "activity.completed", payload: { id, title: activity.title, type: activity.type } } }).catch(() => {});
      }
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
    <div className="p-4 md:p-8">
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

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
          {(["pending", "done", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${filter === f ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              {f === "pending" ? "Pendentes" : f === "done" ? "Concluídas" : "Todas"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
          <button onClick={() => setView("list")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${view === "list" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            <List className="h-3.5 w-3.5" />Lista
          </button>
          <button onClick={() => setView("agenda")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${view === "agenda" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
            <CalendarDays className="h-3.5 w-3.5" />Agenda
          </button>
        </div>
        <SavedViews
          entity="activities"
          currentFilters={{ filter, view }}
          onApply={(f: Record<string, unknown>) => {
            if (f.filter) setFilter(f.filter as typeof filter);
            if (f.view) setView(f.view as typeof view);
          }}
        />
      </div>

      {view === "list" ? (
        <div className="space-y-2">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          {!isLoading && filtered.length === 0 && (
            <EmptyState
              icon={CheckSquare}
              title="Nenhuma atividade"
              description={filter === "pending" ? "Tudo em dia. Crie uma nova tarefa quando precisar." : "Nada por aqui ainda."}
            />
          )}
          {filtered.map((a) => {
            const type = TYPES.find((t) => t.id === a.type)!;
            const Icon = type.icon;
            return (
              <Card key={a.id} className="flex items-center gap-3 p-4">
                <Checkbox checked={a.completed} onCheckedChange={(v) => toggle.mutate({ id: a.id, completed: !!v, activity: a })} />
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
                {a.due_date && (
                  <Button variant="ghost" size="sm" title="Adicionar ao calendário" onClick={() => downloadICS({ uid: a.id, title: a.title, description: a.description ?? undefined, start: new Date(a.due_date as string), durationMinutes: a.type === "meeting" ? 60 : 30 })}>
                    <CalendarPlus className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover?")) del.mutate(a.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            );
          })}
        </div>
      ) : (
        <AgendaView
          items={filtered.filter((a) => a.due_date) as any[]}
          onToggle={(id, completed, a) => toggle.mutate({ id, completed, activity: a })}
          onDelete={(id) => { if (confirm("Remover?")) del.mutate(id); }}
        />
      )}
    </div>
  );
}

function AgendaView({ items, onToggle, onDelete }: { items: any[]; onToggle: (id: string, completed: boolean, a: any) => void; onDelete: (id: string) => void }) {
  // group by yyyy-mm-dd for next 14 days (or any with due date)
  const groups = new Map<string, any[]>();
  for (const a of items) {
    const d = new Date(a.due_date);
    const key = d.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  const keys = Array.from(groups.keys()).sort();
  if (keys.length === 0) {
    return <EmptyState icon={CalendarDays} title="Sem atividades agendadas" description="Atividades com data de vencimento aparecem aqui." />;
  }
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return (
    <div className="space-y-6">
      {keys.map((k) => {
        const d = new Date(k + "T00:00:00");
        const label = k === today ? "Hoje" : k === tomorrow ? "Amanhã" : d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
        const isPast = k < today;
        return (
          <div key={k}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className={`text-sm font-semibold capitalize ${isPast ? "text-destructive" : ""}`}>{label}</h3>
              <span className="text-xs text-muted-foreground">{groups.get(k)!.length} item{groups.get(k)!.length > 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-1.5">
              {groups.get(k)!.sort((x, y) => new Date(x.due_date).getTime() - new Date(y.due_date).getTime()).map((a) => {
                const type = TYPES.find((t) => t.id === a.type)!;
                const Icon = type.icon;
                const time = new Date(a.due_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                return (
                  <Card key={a.id} className="flex items-center gap-3 p-3">
                    <Checkbox checked={a.completed} onCheckedChange={(v) => onToggle(a.id, !!v, a)} />
                    <span className="w-12 text-xs font-medium text-muted-foreground tabular-nums">{time}</span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`truncate text-sm font-medium ${a.completed ? "text-muted-foreground line-through" : ""}`}>{a.title}</p>
                      {((a.contacts as any)?.name || (a.deals as any)?.title) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {(a.contacts as any)?.name ?? (a.deals as any)?.title}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
