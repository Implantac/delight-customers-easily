import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Inbox, Plus, Calendar as CalIcon, Phone, Mail, CheckSquare, Users as UsersIcon, FileText, Clock } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import {
  listMyTasks,
  setTaskCompleted,
  snoozeTask,
  quickAddTask,
  type MyTask,
} from "@/lib/mytasks.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/mytasks")({
  component: MyTasksPage,
});

const TYPE_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  task: CheckSquare,
  meeting: UsersIcon,
  note: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  call: "Ligação",
  email: "Email",
  task: "Tarefa",
  meeting: "Reunião",
  note: "Nota",
};

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function classify(task: MyTask, todayIso: string, weekEndIso: string): "overdue" | "today" | "week" | "later" | "nodate" {
  if (!task.due_date) return "nodate";
  const day = task.due_date.slice(0, 10);
  if (day < todayIso) return "overdue";
  if (day === todayIso) return "today";
  if (day <= weekEndIso) return "week";
  return "later";
}

function MyTasksPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listMyTasks);
  const toggleFn = useServerFn(setTaskCompleted);
  const snoozeFn = useServerFn(snoozeTask);
  const addFn = useServerFn(quickAddTask);

  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [tab, setTab] = useState("today");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDate, setQuickDate] = useState<string>(isoDay(new Date()));
  const [quickType, setQuickType] = useState<"call" | "email" | "task" | "meeting" | "note">("task");

  const { data, isLoading } = useQuery({
    queryKey: ["mytasks", orgId, includeCompleted],
    queryFn: () => fetchTasks({ data: { organization_id: orgId!, include_completed: includeCompleted } }),
    enabled: !!orgId,
  });

  const toggle = useMutation({
    mutationFn: (vars: { id: string; completed: boolean }) => toggleFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mytasks"] }),
  });

  const snooze = useMutation({
    mutationFn: (vars: { id: string; due_date: string }) => snoozeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Tarefa adiada");
      qc.invalidateQueries({ queryKey: ["mytasks"] });
    },
  });

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          organization_id: orgId!,
          title: quickTitle.trim(),
          due_date: quickDate || null,
          type: quickType,
        },
      }),
    onSuccess: () => {
      toast.success("Tarefa criada");
      setQuickTitle("");
      qc.invalidateQueries({ queryKey: ["mytasks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const todayIso = isoDay(new Date());
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndIso = isoDay(weekEnd);

  const grouped = useMemo(() => {
    const buckets: Record<string, MyTask[]> = { overdue: [], today: [], week: [], later: [], nodate: [] };
    (data?.tasks ?? []).forEach((t) => {
      buckets[classify(t, todayIso, weekEndIso)].push(t);
    });
    return buckets;
  }, [data, todayIso, weekEndIso]);

  const counts = {
    overdue: grouped.overdue.length,
    today: grouped.today.length,
    week: grouped.week.length,
    later: grouped.later.length,
    nodate: grouped.nodate.length,
  };

  const snoozeOptions = [
    { label: "Amanhã", days: 1 },
    { label: "Em 3 dias", days: 3 },
    { label: "Próxima semana", days: 7 },
  ];

  const renderList = (tasks: MyTask[]) => {
    if (tasks.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 mb-2 opacity-40" />
          <p className="text-sm">Nenhuma tarefa nesta categoria.</p>
        </div>
      );
    }
    return (
      <div className="divide-y rounded-md border bg-card">
        {tasks.map((t) => {
          const Icon = TYPE_ICONS[t.type] ?? CheckSquare;
          const overdue = t.due_date && t.due_date.slice(0, 10) < todayIso && !t.completed;
          return (
            <div key={t.id} className="flex items-start gap-3 p-3 hover:bg-accent/30 transition-colors">
              <Checkbox
                checked={t.completed}
                onCheckedChange={(c) => toggle.mutate({ id: t.id, completed: !!c })}
                className="mt-1"
              />
              <Icon className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${t.completed ? "line-through text-muted-foreground" : ""}`}>
                  {t.title}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[t.type] ?? t.type}</Badge>
                  {t.due_date && (
                    <span className={`flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}>
                      <CalIcon className="h-3 w-3" />
                      {new Date(t.due_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {t.description && <span className="truncate">{t.description}</span>}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Clock className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {snoozeOptions.map((opt) => (
                    <DropdownMenuItem
                      key={opt.days}
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + opt.days);
                        snooze.mutate({ id: t.id, due_date: isoDay(d) });
                      }}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Minhas Tarefas</h1>
          <p className="text-sm text-muted-foreground">Inbox unificado de atividades atribuídas a você.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="completed" checked={includeCompleted} onCheckedChange={setIncludeCompleted} />
          <Label htmlFor="completed" className="text-sm">Mostrar concluídas</Label>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Adicionar rápido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-[1fr_160px_140px_auto]">
            <Input
              placeholder="O que precisa ser feito?"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && quickTitle.trim()) add.mutate();
              }}
            />
            <Input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} />
            <Select value={quickType} onValueChange={(v: any) => setQuickType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!quickTitle.trim() || add.isPending}
              onClick={() => add.mutate()}
            >
              <Plus className="h-4 w-4 mr-1" /> Criar
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="overdue">
              Atrasadas <Badge variant="destructive" className="ml-1 text-[10px]">{counts.overdue}</Badge>
            </TabsTrigger>
            <TabsTrigger value="today">
              Hoje <Badge variant="secondary" className="ml-1 text-[10px]">{counts.today}</Badge>
            </TabsTrigger>
            <TabsTrigger value="week">
              7 dias <Badge variant="secondary" className="ml-1 text-[10px]">{counts.week}</Badge>
            </TabsTrigger>
            <TabsTrigger value="later">
              Depois <Badge variant="secondary" className="ml-1 text-[10px]">{counts.later}</Badge>
            </TabsTrigger>
            <TabsTrigger value="nodate">
              Sem data <Badge variant="secondary" className="ml-1 text-[10px]">{counts.nodate}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overdue" className="mt-4">{renderList(grouped.overdue)}</TabsContent>
          <TabsContent value="today" className="mt-4">{renderList(grouped.today)}</TabsContent>
          <TabsContent value="week" className="mt-4">{renderList(grouped.week)}</TabsContent>
          <TabsContent value="later" className="mt-4">{renderList(grouped.later)}</TabsContent>
          <TabsContent value="nodate" className="mt-4">{renderList(grouped.nodate)}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}
