import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trophy, Medal, Award, Target as TargetIcon } from "lucide-react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { getLeaderboard, upsertGoal } from "@/lib/goals.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/goals")({
  component: GoalsPage,
});

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function GoalsPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const fetchLeaderboard = useServerFn(getLeaderboard);
  const saveGoal = useServerFn(upsertGoal);
  const [month, setMonth] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [target, setTarget] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", orgId, month],
    queryFn: () => fetchLeaderboard({ data: { organization_id: orgId!, period_month: month } }),
    enabled: !!orgId,
  });

  const mutation = useMutation({
    mutationFn: (payload: { user_id: string; target_value: number }) =>
      saveGoal({
        data: {
          organization_id: orgId!,
          user_id: payload.user_id,
          period_month: month,
          target_value: payload.target_value,
        },
      }),
    onSuccess: () => {
      toast.success("Meta salva");
      qc.invalidateQueries({ queryKey: ["leaderboard", orgId, month] });
      setOpen(false);
      setSelectedUser("");
      setTarget("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const rows = data?.rows ?? [];
  const top = rows.slice(0, 3);

  const totals = useMemo(() => {
    const t = rows.reduce(
      (acc, r) => {
        acc.target += r.target_value;
        acc.achieved += r.achieved_value;
        acc.deals += r.deals_won;
        return acc;
      },
      { target: 0, achieved: 0, deals: 0 },
    );
    const progress = t.target > 0 ? (t.achieved / t.target) * 100 : 0;
    return { ...t, progress };
  }, [rows]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Metas & Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o progresso da equipe contra metas mensais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-[180px]"
          />
          {canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <TargetIcon className="mr-2 h-4 w-4" /> Definir meta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Definir meta para {month}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid gap-2">
                    <Label>Vendedor</Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {rows.map((r) => (
                          <SelectItem key={r.user_id} value={r.user_id}>
                            {r.user_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Meta (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="50000"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    disabled={!selectedUser || !target || mutation.isPending}
                    onClick={() =>
                      mutation.mutate({
                        user_id: selectedUser,
                        target_value: Number(target),
                      })
                    }
                  >
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Meta total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtBRL(totals.target)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Realizado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtBRL(totals.achieved)}</div>
            <Progress value={Math.min(totals.progress, 100)} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {totals.progress.toFixed(1)}% da meta
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Negócios fechados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.deals}</div>
          </CardContent>
        </Card>
      </div>

      {top.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top.map((r, i) => {
            const Icon = i === 0 ? Trophy : i === 1 ? Medal : Award;
            const color =
              i === 0
                ? "text-yellow-500"
                : i === 1
                  ? "text-gray-400"
                  : "text-amber-700";
            return (
              <Card key={r.user_id}>
                <CardContent className="flex items-center gap-4 pt-6">
                  <Icon className={`h-10 w-10 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{r.user_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {fmtBRL(r.achieved_value)} · {r.deals_won} negócios
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ranking</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sem dados para este período.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => {
                const initials = r.user_name
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const pct = Math.min(r.progress, 100);
                return (
                  <div
                    key={r.user_id}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-card"
                  >
                    <div className="w-8 text-center font-bold text-muted-foreground">
                      #{r.rank}
                    </div>
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="font-medium truncate">{r.user_name}</span>
                        <span className="text-sm font-mono">
                          {fmtBRL(r.achieved_value)}
                          {r.target_value > 0 && (
                            <span className="text-muted-foreground">
                              {" "}/ {fmtBRL(r.target_value)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={pct} className="flex-1 h-2" />
                        <span className="text-xs text-muted-foreground w-14 text-right">
                          {r.target_value > 0 ? `${r.progress.toFixed(0)}%` : "—"}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground hidden sm:block">
                      {r.deals_won} {r.deals_won === 1 ? "venda" : "vendas"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
