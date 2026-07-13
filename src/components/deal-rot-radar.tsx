import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDealRotSignals, nudgeDealRot, type RotSignal } from "@/lib/deal-rot.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Clock, TrendingDown, Zap, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function DealRotRadar({ orgId, onOpenDeal }: { orgId?: string; onOpenDeal?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();
  const fetchSignals = useServerFn(getDealRotSignals);
  const nudge = useServerFn(nudgeDealRot);

  const q = useQuery({
    queryKey: ["deal-rot", orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: () => fetchSignals({ data: { organization_id: orgId!, limit: 30 } }),
  });

  const nudgeMut = useMutation({
    mutationFn: (deal_id: string) => nudge({ data: { organization_id: orgId!, deal_id } }),
    onSuccess: () => {
      toast.success("Tarefa criada — retomar em 24h");
      qc.invalidateQueries({ queryKey: ["deal-rot", orgId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falhou"),
  });

  const items = q.data?.items ?? [];
  const shown = expanded ? items : items.slice(0, 5);
  const atRisk = q.data?.total_value_at_risk ?? 0;

  const bySeverity = useMemo(() => {
    const g = { high: 0, medium: 0, low: 0 };
    for (const i of items) g[i.severity]++;
    return g;
  }, [items]);

  if (q.isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-5 w-40 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="h-4 w-4 text-emerald-500" />
          <span>Nenhum negócio parado além do SLA. Funil saudável.</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-r from-amber-500/5 to-red-500/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold">Deal Rot Radar</h3>
          <Badge variant="secondary" className="ml-1">{items.length}</Badge>
          {bySeverity.high > 0 && (
            <Badge className="bg-red-500/15 text-red-600 border-red-500/30">{bySeverity.high} críticos</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendingDown className="h-3.5 w-3.5" />
          <span>Valor em risco:</span>
          <span className="font-semibold text-foreground">{BRL(atRisk)}</span>
        </div>
      </div>

      <ul className="divide-y divide-border/60">
        {shown.map((s) => (
          <RotRow key={s.deal_id} s={s} onOpen={onOpenDeal} onNudge={() => nudgeMut.mutate(s.deal_id)} nudging={nudgeMut.isPending} />
        ))}
      </ul>

      {items.length > 5 && (
        <div className="border-t border-border/60 p-2 text-center">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Recolher" : `Ver todos (${items.length})`}
          </Button>
        </div>
      )}
    </Card>
  );
}

function RotRow({
  s,
  onOpen,
  onNudge,
  nudging,
}: {
  s: RotSignal;
  onOpen?: (id: string) => void;
  onNudge: () => void;
  nudging: boolean;
}) {
  const sevClass =
    s.severity === "high"
      ? "border-l-red-500 bg-red-500/[0.03]"
      : s.severity === "medium"
        ? "border-l-amber-500 bg-amber-500/[0.03]"
        : "border-l-slate-400";

  return (
    <li className={`border-l-4 ${sevClass} px-4 py-2.5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              className="truncate text-sm font-medium hover:underline"
              onClick={() => onOpen?.(s.deal_id)}
              title={s.title}
            >
              {s.title}
            </button>
            <Badge variant="outline" className="text-[10px]">{s.stage_label}</Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.days_in_stage}d ({+s.overdue_days > 0 ? `+${s.overdue_days}d além do SLA` : "no SLA"})</span>
            <span>{BRL(s.value)}</span>
            {s.owner_name && <span>· {s.owner_name}</span>}
          </div>
          <p className="mt-1 text-xs text-foreground/80"><span className="font-medium">Ação:</span> {s.action}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={onNudge} disabled={nudging}>
            Retomar
          </Button>
          {onOpen && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onOpen(s.deal_id)}>
              Abrir <ChevronRight className="ml-0.5 h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
