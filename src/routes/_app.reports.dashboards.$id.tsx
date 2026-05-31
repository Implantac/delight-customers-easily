import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, lazy, Suspense } from "react";
import { useCurrentOrg } from "@/lib/org";
import { useCanManage } from "@/lib/permissions";
import { getDashboard, addWidget, deleteWidget, runWidget } from "@/lib/dashboards.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, Trash2, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const BarByStage = lazy(() => import("@/components/dashboard-charts").then((m) => ({ default: m.BarByStage })));
const LineRevenue = lazy(() => import("@/components/dashboard-charts").then((m) => ({ default: m.LineRevenue })));

const ChartFallback = () => <div className="h-56 animate-pulse bg-muted/40 rounded" />;

export const Route = createFileRoute("/_app/reports/dashboards/$id")({ component: DashboardDetailPage });

const WIDGET_OPTIONS = [
  { id: "kpi_won_month", label: "KPI — Vendas do mês" },
  { id: "kpi_pipeline_open", label: "KPI — Pipeline aberto" },
  { id: "kpi_deals_count", label: "KPI — Total de negócios" },
  { id: "bar_by_stage", label: "Barra — Valor por estágio" },
  { id: "line_revenue_6m", label: "Linha — Receita 6 meses" },
  { id: "funnel_conversion", label: "Funil de conversão" },
  { id: "top_reps", label: "Top vendedores (mês)" },
  { id: "goal_progress", label: "Progresso da meta" },
  { id: "recent_activities", label: "Atividades recentes" },
];

function DashboardDetailPage() {
  const { id } = Route.useParams();
  const { orgId } = useCurrentOrg();
  const canManage = useCanManage();
  const qc = useQueryClient();
  const getFn = useServerFn(getDashboard);
  const addFn = useServerFn(addWidget);
  const delFn = useServerFn(deleteWidget);

  const q = useQuery({
    queryKey: ["dashboard", id],
    queryFn: () => getFn({ data: { id } }),
    enabled: !!id,
  });

  const [open, setOpen] = useState(false);
  const [wtype, setWtype] = useState<string>("kpi_won_month");
  const [title, setTitle] = useState("");

  const addMut = useMutation({
    mutationFn: () => addFn({ data: { dashboard_id: id, organization_id: orgId!, widget_type: wtype as any, title: title || (WIDGET_OPTIONS.find((o) => o.id === wtype)?.label ?? "Widget") } }),
    onSuccess: () => { toast.success("Widget adicionado"); setOpen(false); setTitle(""); qc.invalidateQueries({ queryKey: ["dashboard", id] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (wid: string) => delFn({ data: { id: wid } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["dashboard", id] }); },
  });

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <PageHeader
        title={q.data?.dashboard?.name ?? "Dashboard"}
        subtitle={q.data?.dashboard?.description ?? undefined}
        icon={LayoutDashboard}
        action={
          <div className="flex gap-2">
            <Link to="/reports/dashboards"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button></Link>
            {canManage && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Widget</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Adicionar widget</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Tipo</Label>
                      <Select value={wtype} onValueChange={setWtype}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {WIDGET_OPTIONS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Título (opcional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Personalize" /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={() => addMut.mutate()} disabled={addMut.isPending}>Adicionar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      {q.data?.widgets.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum widget. Adicione o primeiro!</Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {q.data?.widgets.map((w: any) => (
          <WidgetCard key={w.id} widget={w} orgId={orgId!} canManage={canManage} onDelete={() => { if (confirm("Remover?")) delMut.mutate(w.id); }} />
        ))}
      </div>
    </div>
  );
}

function WidgetCard({ widget, orgId, canManage, onDelete }: { widget: any; orgId: string; canManage: boolean; onDelete: () => void }) {
  const runFn = useServerFn(runWidget);
  const q = useQuery({
    queryKey: ["widget", widget.id],
    queryFn: () => runFn({ data: { widget_id: widget.id, organization_id: orgId } }),
    refetchInterval: 60_000,
  });

  const t = widget.widget_type;
  const isKpi = t.startsWith("kpi_") || t === "goal_progress";

  return (
    <Card className={`p-4 ${isKpi ? "" : "md:col-span-2"}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-xs text-muted-foreground">{WIDGET_OPTIONS.find((o) => o.id === t)?.label}</div>
          <h3 className="font-semibold">{widget.title}</h3>
        </div>
        {canManage && <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
      </div>
      <WidgetBody type={t} data={q.data} loading={q.isLoading} />
    </Card>
  );
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function WidgetBody({ type, data, loading }: { type: string; data: any; loading: boolean }) {
  if (loading || !data) return <div className="h-24 animate-pulse bg-muted/40 rounded" />;
  if (type === "kpi_won_month" || type === "kpi_pipeline_open") {
    return (
      <div>
        <div className="text-3xl font-bold">{fmtBRL(Number(data.value || 0))}</div>
        {data.count != null && <div className="text-xs text-muted-foreground">{data.count} negócios</div>}
      </div>
    );
  }
  if (type === "kpi_deals_count") return <div className="text-3xl font-bold">{data.value ?? 0}</div>;
  if (type === "goal_progress") {
    const pct = data.attainment != null ? Math.min(100, Math.round(data.attainment * 100)) : 0;
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-sm"><span>{fmtBRL(Number(data.realized || 0))}</span><span className="text-muted-foreground">/ {fmtBRL(Number(data.target || 0))}</span></div>
        <Progress value={pct} />
        <div className="text-xs text-muted-foreground">{pct}% da meta</div>
      </div>
    );
  }
  if (type === "bar_by_stage") {
    return (
      <Suspense fallback={<ChartFallback />}>
        <BarByStage data={data.data} />
      </Suspense>
    );
  }
  if (type === "line_revenue_6m") {
    return (
      <Suspense fallback={<ChartFallback />}>
        <LineRevenue data={data.data} />
      </Suspense>
    );
  }
  if (type === "funnel_conversion") {
    return (
      <div className="space-y-1">
        {data.data.map((r: any) => (
          <div key={r.stage} className="flex items-center gap-2 text-sm">
            <span className="w-24 capitalize">{r.stage}</span>
            <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${Math.min(100, r.count * 5)}%` }} />
            </div>
            <span className="w-12 text-right tabular-nums">{r.count}</span>
          </div>
        ))}
      </div>
    );
  }
  if (type === "top_reps") {
    return (
      <div className="space-y-2">
        {data.data.map((r: any, i: number) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="truncate">{i + 1}. {r.name}</span>
            <span className="font-medium tabular-nums">{fmtBRL(r.value)}</span>
          </div>
        ))}
        {data.data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum negócio ganho neste mês.</p>}
      </div>
    );
  }
  if (type === "recent_activities") {
    return (
      <div className="space-y-2">
        {data.data.map((a: any) => (
          <div key={a.id} className="text-sm flex justify-between gap-2">
            <span className="truncate">{a.title}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}
