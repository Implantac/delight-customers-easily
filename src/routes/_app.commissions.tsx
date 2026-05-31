import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Coins, Trophy, Target, TrendingUp } from "lucide-react";
import { getCommissionReport, listCommissionRules, upsertCommissionRule } from "@/lib/commissions.functions";
import { generatePayouts, listPayouts, setPayoutStatus } from "@/lib/payouts.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/commissions")({ component: CommissionsPage });

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const PCT = (n: number | null) => n == null ? "—" : `${(n * 100).toFixed(0)}%`;

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function CommissionsPage() {
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const [period, setPeriod] = useState(currentMonth());

  const callReport = useServerFn(getCommissionReport);
  const callRules = useServerFn(listCommissionRules);

  const report = useQuery({
    queryKey: ["commission-report", orgId, period],
    enabled: !!orgId,
    queryFn: () => callReport({ data: { organization_id: orgId!, period_month: period } }),
  });

  const rules = useQuery({
    queryKey: ["commission-rules", orgId],
    enabled: !!orgId && canManage,
    queryFn: () => callRules({ data: { organization_id: orgId! } }),
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Comissões"
        subtitle="Cálculo automático baseado em deals ganhos e metas batidas."
        action={
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value || currentMonth())}
            className="w-40"
          />
        }
      />

      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">Relatório do mês</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          {canManage && <TabsTrigger value="rules">Regras</TabsTrigger>}
        </TabsList>

        <TabsContent value="report" className="mt-4 space-y-6">
          {report.isLoading || !report.data ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[0,1,2,3].map((i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5" />Receita ganha</div>
                  <div className="mt-2 text-3xl font-semibold">{BRL(report.data.totals.sold)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{report.data.totals.deals} negócios fechados</div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Coins className="h-3.5 w-3.5" />Comissão total</div>
                  <div className="mt-2 text-3xl font-semibold">{BRL(report.data.totals.total)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {report.data.totals.sold > 0
                      ? `${((report.data.totals.total / report.data.totals.sold) * 100).toFixed(1)}% do faturamento`
                      : "—"}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5" />Regra ativa</div>
                  <div className="mt-2 text-lg font-semibold truncate">{report.data.rule.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {Number(report.data.rule.base_percent).toFixed(2)}% base • +{Number(report.data.rule.accelerator_percent).toFixed(2)}% acelerador
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5" />Bônus por meta</div>
                  <div className="mt-2 text-3xl font-semibold">{BRL(Number(report.data.rule.quota_bonus))}</div>
                  <div className="mt-1 text-xs text-muted-foreground">pago a quem bateu a meta</div>
                </Card>
              </div>

              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Vendedor</th>
                      <th className="px-4 py-2 text-right">Vendido</th>
                      <th className="px-4 py-2 text-right">Meta</th>
                      <th className="px-4 py-2">Atingimento</th>
                      <th className="px-4 py-2 text-right">Base</th>
                      <th className="px-4 py-2 text-right">Acelerador</th>
                      <th className="px-4 py-2 text-right">Bônus</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.data.rows.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Sem vendas no período.</td></tr>
                    ) : report.data.rows.map((r) => (
                      <tr key={r.user_id} className="border-t">
                        <td className="px-4 py-3 font-medium">{r.name}</td>
                        <td className="px-4 py-3 text-right">{BRL(r.sold)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{r.goal > 0 ? BRL(r.goal) : "—"}</td>
                        <td className="px-4 py-3 w-40">
                          {r.attainment != null ? (
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(100, r.attainment * 100)} className="h-2" />
                              <span className="text-xs text-muted-foreground w-10 text-right">{PCT(r.attainment)}</span>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">{BRL(r.baseCommission)}</td>
                        <td className="px-4 py-3 text-right text-blue-500">{r.accelerator > 0 ? BRL(r.accelerator) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {r.bonus > 0 ? <Badge className="bg-emerald-500/10 text-emerald-600">+{BRL(r.bonus)}</Badge> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{BRL(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="rules" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <RuleDialog orgId={orgId!} />
            </div>
            {rules.isLoading || !rules.data ? (
              <Skeleton className="h-40" />
            ) : (
              <Card className="p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Nome</th>
                      <th className="px-4 py-2 text-right">% Base</th>
                      <th className="px-4 py-2 text-right">% Acelerador</th>
                      <th className="px-4 py-2 text-right">Bônus por meta</th>
                      <th className="px-4 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.data.rules.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhuma regra criada ainda.</td></tr>
                    ) : rules.data.rules.map((r: any) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-3 font-medium">{r.name}</td>
                        <td className="px-4 py-3 text-right">{Number(r.base_percent).toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right">{Number(r.accelerator_percent).toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right">{BRL(Number(r.quota_bonus))}</td>
                        <td className="px-4 py-3 text-center">
                          {r.active ? <Badge>Ativa</Badge> : <Badge variant="outline">Inativa</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function RuleDialog({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Regra padrão");
  const [base, setBase] = useState("5");
  const [accel, setAccel] = useState("2");
  const [bonus, setBonus] = useState("0");
  const [active, setActive] = useState(true);
  const qc = useQueryClient();
  const call = useServerFn(upsertCommissionRule);
  const mut = useMutation({
    mutationFn: () => call({ data: {
      organization_id: orgId,
      name,
      base_percent: Number(base) || 0,
      accelerator_percent: Number(accel) || 0,
      quota_bonus: Number(bonus) || 0,
      active,
    }}),
    onSuccess: () => {
      toast.success("Regra salva");
      qc.invalidateQueries({ queryKey: ["commission-rules", orgId] });
      qc.invalidateQueries({ queryKey: ["commission-report"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nova regra</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova regra de comissão</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>% Base</Label>
              <Input type="number" step="0.1" value={base} onChange={(e) => setBase(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>% Acelerador</Label>
              <Input type="number" step="0.1" value={accel} onChange={(e) => setAccel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Bônus (R$)</Label>
              <Input type="number" step="100" value={bonus} onChange={(e) => setBonus(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            % Base aplica sobre tudo que foi vendido. % Acelerador aplica sobre o valor que excede a meta. Bônus é pago integralmente quem bate a meta.
          </p>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Ativa (desativa as outras automaticamente)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
