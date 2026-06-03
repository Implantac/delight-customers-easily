import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Calendar as CalIcon, Phone, Mail,
  CheckSquare, Users as UsersIcon, FileText, Clock, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import {
  getCalendarActivities,
  toggleActivityComplete,
} from "@/lib/calendar.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

const TYPE_ICONS: Record<string, any> = {
  call: Phone,
  email: Mail,
  task: CheckSquare,
  meeting: UsersIcon,
  note: FileText,
};

// Semantic tokens via opacity — adaptam-se automaticamente ao tema claro/escuro
const TYPE_COLORS: Record<string, string> = {
  call: "bg-primary/10 text-primary border-primary/20",
  email: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  task: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  meeting: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  note: "bg-muted text-muted-foreground border-border",
};

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function startOfMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return start;
}

function CalendarPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const fetchActs = useServerFn(getCalendarActivities);
  const toggleFn = useServerFn(toggleActivityComplete);
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [mineOnly, setMineOnly] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const gridStart = useMemo(
    () => startOfMonthGrid(cursor.y, cursor.m),
    [cursor.y, cursor.m],
  );
  const gridEnd = useMemo(() => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + 42);
    return d;
  }, [gridStart]);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", orgId, cursor.y, cursor.m, mineOnly],
    queryFn: () =>
      fetchActs({
        data: {
          organization_id: orgId!,
          from: gridStart.toISOString(),
          to: gridEnd.toISOString(),
          mine_only: mineOnly,
        },
      }),
    enabled: !!orgId,
  });

  const toggle = useMutation({
    mutationFn: (p: { id: string; completed: boolean }) =>
      toggleFn({ data: { ...p, organization_id: orgId! } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar", orgId] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, typeof data extends { activities: infer A } ? A : any[]>();
    for (const a of data?.activities ?? []) {
      const key = a.due_date.slice(0, 10);
      const arr = (map.get(key) as any[]) ?? [];
      arr.push(a);
      map.set(key, arr as any);
    }
    return map as Map<string, any[]>;
  }, [data]);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, [gridStart]);

  const todayKey = today.toISOString().slice(0, 10);
  const selected = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  const goPrev = () =>
    setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  const goNext = () =>
    setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));
  const goToday = () => setCursor({ y: today.getFullYear(), m: today.getMonth() });

  const stats = useMemo(() => {
    const acts = data?.activities ?? [];
    const now = new Date();
    const todayK = now.toISOString().slice(0, 10);
    let today = 0, overdue = 0, done = 0, week = 0;
    const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
    for (const a of acts) {
      const d = new Date(a.due_date);
      const k = a.due_date.slice(0, 10);
      if (a.completed) { done++; continue; }
      if (k === todayK) today++;
      if (d < now && k !== todayK) overdue++;
      if (d >= now && d <= weekEnd) week++;
    }
    return { today, overdue, done, week };
  }, [data]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Agenda Comercial"
        subtitle="Onde estão suas ações de hoje, da semana e o que ficou para trás."
        icon={CalIcon}
        action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="mine" checked={mineOnly} onCheckedChange={setMineOnly} />
              <Label htmlFor="mine" className="text-sm">Só minhas</Label>
            </div>
            <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[160px] text-center">
                {MONTHS[cursor.m]} {cursor.y}
              </div>
              <Button variant="ghost" size="icon" onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCell label="Para hoje" value={stats.today} icon={Clock} tone="primary" />
        <KpiCell label="Próximos 7 dias" value={stats.week} icon={CalIcon} />
        <KpiCell label="Atrasadas" value={stats.overdue} icon={AlertCircle} tone="danger" />
        <KpiCell label="Concluídas" value={stats.done} icon={CheckCircle2} tone="ok" />
      </div>


      <Card>
        <CardContent className="p-2">
          {isLoading ? (
            <Skeleton className="h-[600px] w-full" />
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {WEEK_DAYS.map((d) => (
                <div
                  key={d}
                  className="text-xs font-medium text-muted-foreground text-center py-2"
                >
                  {d}
                </div>
              ))}
              {days.map((d) => {
                const key = d.toISOString().slice(0, 10);
                const inMonth = d.getMonth() === cursor.m;
                const acts = byDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(key)}
                    className={`min-h-[96px] rounded-md border text-left p-1.5 transition-colors hover:bg-accent ${
                      inMonth ? "bg-card" : "bg-muted/30"
                    } ${isToday ? "border-primary border-2" : "border-border"}`}
                  >
                    <div
                      className={`text-xs font-medium mb-1 ${
                        inMonth ? "" : "text-muted-foreground"
                      } ${isToday ? "text-primary" : ""}`}
                    >
                      {d.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {acts.slice(0, 3).map((a: any) => {
                        const Icon = TYPE_ICONS[a.type] ?? CheckSquare;
                        return (
                          <div
                            key={a.id}
                            className={`flex items-center gap-1 text-[10px] truncate rounded px-1 py-0.5 border ${
                              TYPE_COLORS[a.type] ?? TYPE_COLORS.task
                            } ${a.completed ? "line-through opacity-60" : ""}`}
                          >
                            <Icon className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{a.title}</span>
                          </div>
                        );
                      })}
                      {acts.length > 3 && (
                        <div className="text-[10px] text-muted-foreground">
                          +{acts.length - 3} mais
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalIcon className="h-5 w-5" />
              {selectedDay &&
                new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
            </DialogTitle>
          </DialogHeader>
          {selected.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma atividade neste dia.
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {selected.map((a: any) => {
                const Icon = TYPE_ICONS[a.type] ?? CheckSquare;
                const time = new Date(a.due_date).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 p-3 rounded-lg border"
                  >
                    <input
                      type="checkbox"
                      checked={a.completed}
                      onChange={(e) =>
                        toggle.mutate({ id: a.id, completed: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-medium ${a.completed ? "line-through text-muted-foreground" : ""}`}
                        >
                          {a.title}
                        </span>
                        <Badge variant="outline" className="text-xs gap-1">
                          <Icon className="h-3 w-3" /> {a.type}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCell({
  label, value, icon: Icon, tone,
}: { label: string; value: number; icon: any; tone?: "primary" | "ok" | "danger" }) {
  const color =
    tone === "danger" ? "text-destructive"
    : tone === "ok" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "primary" ? "text-primary"
    : "text-foreground";
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className={`text-2xl font-semibold mt-1 tracking-tight ${color}`}>{value}</div>
    </Card>
  );
}
