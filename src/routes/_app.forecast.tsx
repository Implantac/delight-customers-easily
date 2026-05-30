import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { getForecast, listGoals, upsertGoal, deleteGoal } from "@/lib/forecast.functions";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Target, TrendingUp, Trophy, AlertCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/forecast")({ component: ForecastPage });

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
};

function ForecastPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const fn = useServerFn(getForecast);

  const { data, isLoading } = useQuery({
    queryKey: ["forecast", orgId],
    enabled: !!orgId,
    queryFn: () => fn({ data: { organization_id: orgId! } }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4 p-4 md:p-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 md:grid-cols-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const { current, months, reps } = data;
  const maxBar = Math.max(1, ...months.map(m => Math.max(m.target, m.won + m.weighted, m.best)));

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Previsão de Vendas"
        subtitle="Forecast ponderado pelo pipeline e progresso vs. meta deste mês."
        action={canManage ? <GoalsDialog orgId={orgId!} /> : null}
      />

      <NextActionBlock surface="forecast" title="Como fechar o mês" showRegenerate />


      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={Target} label="Meta do mês" value={current.target > 0 ? fmt(current.target) : "—"} />
        <Kpi icon={Trophy} label="Ganho no mês" value={fmt(current.won)} tone="emerald" />
        <Kpi icon={TrendingUp} label="Projeção (ganho + ponderado)" value={fmt(current.projected)} tone="primary" />
        <Kpi
          icon={AlertCircle}
          label="Gap para meta"
          value={current.target > 0 ? fmt(current.gap) : "—"}
          tone={current.gap === 0 && current.target > 0 ? "emerald" : "rose"}
          subtitle={current.target > 0 ? `${current.attainment}% atingido` : "Defina uma meta"}
        />
      </div>

      {/* Pipeline buckets do mês corrente */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Composição do mês ({monthLabel(current.month)})</h3>
        <div className="grid gap-3 md:grid-cols-4 text-sm">
          <Bucket label="Ganho" value={current.won} tone="emerald" />
          <Bucket label="Comprometido (≥75%)" value={current.committed} tone="primary" />
          <Bucket label="Ponderado" value={current.weighted} tone="amber" />
          <Bucket label="Best case (100%)" value={current.best} tone="sky" />
        </div>
      </Card>

      {/* Série mensal */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Próximos 6 meses</h3>
        <div className="space-y-3">
          {months.map((m) => {
            const projected = m.won + m.weighted;
            const targetW = m.target > 0 ? (m.target / maxBar) * 100 : 0;
            const wonW = (m.won / maxBar) * 100;
            const weightedW = (m.weighted / maxBar) * 100;
            const attainment = m.target > 0 ? Math.round((projected / m.target) * 100) : null;
            return (
              <div key={m.month}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">{monthLabel(m.month)}</span>
                  <span className="text-muted-foreground">
                    {fmt(projected)} {m.target > 0 && <>/ {fmt(m.target)} · {attainment}%</>}
                  </span>
                </div>
                <div className="relative h-7 rounded bg-muted/40 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-emerald-500/80" style={{ width: `${wonW}%` }} />
                  <div className="absolute inset-y-0 bg-amber-500/70" style={{ left: `${wonW}%`, width: `${weightedW}%` }} />
                  {m.target > 0 && (
                    <div
                      className="absolute inset-y-0 w-0.5 bg-foreground/80"
                      style={{ left: `${targetW}%` }}
                      title={`Meta: ${fmt(m.target)}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <Legend color="bg-emerald-500/80" label="Ganho" />
          <Legend color="bg-amber-500/70" label="Ponderado" />
          <Legend color="bg-foreground/80 w-0.5" label="Meta" line />
        </div>
      </Card>

      {/* Gap por vendedor */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Performance por vendedor (mês corrente)</h3>
        {reps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Defina metas individuais para acompanhar a performance de cada vendedor.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2 font-medium">Vendedor</th>
                  <th className="text-right py-2 font-medium">Meta</th>
                  <th className="text-right py-2 font-medium">Ganho</th>
                  <th className="text-right py-2 font-medium">Projeção</th>
                  <th className="text-right py-2 font-medium">Gap</th>
                  <th className="text-right py-2 font-medium">% Meta</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((r) => {
                  const projected = r.won + r.weighted;
                  return (
                    <tr key={r.user_id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{r.name}</td>
                      <td className="py-2 text-right">{r.target > 0 ? fmt(r.target) : "—"}</td>
                      <td className="py-2 text-right">{fmt(r.won)}</td>
                      <td className="py-2 text-right">{fmt(projected)}</td>
                      <td className="py-2 text-right">{r.target > 0 ? fmt(r.gap) : "—"}</td>
                      <td className="py-2 text-right">
                        {r.target > 0 ? (
                          <Badge variant={r.attainment >= 100 ? "default" : r.attainment >= 70 ? "secondary" : "destructive"}>
                            {r.attainment}%
                          </Badge>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone = "default", subtitle }: any) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    primary: "text-primary",
    emerald: "text-emerald-500",
    rose: "text-rose-500",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </Card>
  );
}

function Bucket({ label, value, tone }: { label: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    emerald: "border-l-emerald-500",
    primary: "border-l-primary",
    amber: "border-l-amber-500",
    sky: "border-l-sky-500",
  };
  return (
    <div className={`border-l-4 pl-3 ${tones[tone]}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold mt-0.5">{fmt(value)}</p>
    </div>
  );
}

function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`${line ? "h-3" : "h-2 w-3"} ${color} rounded`} />
      {label}
    </span>
  );
}

// ---------------- Goals Dialog ----------------
function GoalsDialog({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const listFn = useServerFn(listGoals);
  const upsertFn = useServerFn(upsertGoal);
  const deleteFn = useServerFn(deleteGoal);

  const { data: goalsData } = useQuery({
    queryKey: ["goals", orgId],
    enabled: open,
    queryFn: () => listFn({ data: { organization_id: orgId } }),
  });

  const { data: members } = useQuery({
    queryKey: ["org-members-with-profile", orgId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("user_id")
        .eq("organization_id", orgId);
      if (error) throw error;
      const ids = (data ?? []).map((m: any) => m.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      return (profs ?? []) as { id: string; full_name: string }[];
    },
  });

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [periodMonth, setPeriodMonth] = useState(defaultMonth);
  const [userId, setUserId] = useState<string>("__org__");
  const [target, setTarget] = useState<string>("");

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          organization_id: orgId,
          user_id: userId === "__org__" ? null : userId,
          period_month: periodMonth,
          target_value: Number(target) || 0,
        },
      }),
    onSuccess: () => {
      toast.success("Meta salva");
      setTarget("");
      qc.invalidateQueries({ queryKey: ["goals", orgId] });
      qc.invalidateQueries({ queryKey: ["forecast", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Meta removida");
      qc.invalidateQueries({ queryKey: ["goals", orgId] });
      qc.invalidateQueries({ queryKey: ["forecast", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const nameOf = (uid: string | null) => {
    if (!uid) return "Meta da organização";
    return members?.find((m) => m.id === uid)?.full_name ?? "Sem nome";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" />Gerenciar metas</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Metas de vendas</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Mês</Label>
            <Input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
          </div>
          <div>
            <Label>Atribuir a</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__org__">Organização (total)</SelectItem>
                {members?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="number" min="0" step="100" value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="100000"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={() => save.mutate()} disabled={!target || save.isPending} className="w-full">
              Salvar meta
            </Button>
          </div>
        </div>

        <div className="mt-4 max-h-80 overflow-y-auto border-t pt-3">
          {(goalsData?.goals ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma meta cadastrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Mês</th>
                  <th className="text-left py-1">Atribuição</th>
                  <th className="text-right py-1">Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(goalsData?.goals ?? []).map((g: any) => (
                  <tr key={g.id} className="border-t">
                    <td className="py-2">{monthLabel(g.period_month.slice(0, 7))}</td>
                    <td className="py-2">{nameOf(g.user_id)}</td>
                    <td className="py-2 text-right">{fmt(Number(g.target_value))}</td>
                    <td className="py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => remove.mutate(g.id)}>
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
