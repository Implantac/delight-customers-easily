import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getSlaDashboard, syncSlaState } from "@/lib/whatsapp-sla.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function WhatsAppSlaPanel({ onPick }: { onPick?: (id: string) => void }) {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const dash = useServerFn(getSlaDashboard);
  const sync = useServerFn(syncSlaState);

  const q = useQuery({
    queryKey: ["wa-sla", orgId],
    enabled: !!orgId,
    queryFn: () => dash({ data: { organization_id: orgId! } }),
    refetchInterval: 60_000,
  });

  const syncM = useMutation({
    mutationFn: () => sync({ data: { organization_id: orgId! } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["wa-sla", orgId] });
      qc.invalidateQueries({ queryKey: ["wa"] });
      toast.success(`SLA sincronizado: ${r.updated} conversas marcadas`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  if (q.isLoading || !q.data) {
    return <Skeleton className="h-32 w-full" />;
  }
  const d = q.data;
  const tone = d.compliance_pct >= 90 ? "text-emerald-600" : d.compliance_pct >= 70 ? "text-amber-600" : "text-destructive";

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">SLA WhatsApp</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={() => syncM.mutate()} disabled={syncM.isPending} className="gap-1">
          <RefreshCw className={`h-3 w-3 ${syncM.isPending ? "animate-spin" : ""}`} /> Sincronizar
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Compliance</div>
          <div className={`text-2xl font-bold ${tone}`}>{d.compliance_pct}%</div>
          <Progress value={d.compliance_pct} className="h-1.5 mt-1" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Violadas</div>
          <div className="text-2xl font-bold text-destructive">{d.breached_count}</div>
          <div className="text-[11px] text-muted-foreground">precisam ação agora</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Em risco</div>
          <div className="text-2xl font-bold text-amber-600">{d.at_risk_count}</div>
          <div className="text-[11px] text-muted-foreground">vencem em &lt; 5min</div>
        </div>
      </div>

      {(d.breached.length > 0 || d.at_risk.length > 0) && (
        <div className="mt-4 border-t pt-3 space-y-1.5 max-h-56 overflow-auto">
          {d.breached.slice(0, 8).map((c) => (
            <button
              key={c.id}
              onClick={() => onPick?.(c.id)}
              className="w-full flex items-center justify-between text-left text-xs p-2 rounded hover:bg-muted/50"
            >
              <span className="flex items-center gap-2 min-w-0 truncate">
                <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                <span className="truncate font-medium">{c.contact_name}</span>
                <Badge variant="outline" className="text-[10px]">{c.priority}</Badge>
              </span>
              <span className="text-destructive font-mono shrink-0">
                {Math.abs(c.minutes_to_due)}min atraso
              </span>
            </button>
          ))}
          {d.at_risk.slice(0, 4).map((c) => (
            <button
              key={c.id}
              onClick={() => onPick?.(c.id)}
              className="w-full flex items-center justify-between text-left text-xs p-2 rounded hover:bg-muted/50"
            >
              <span className="flex items-center gap-2 min-w-0 truncate">
                <Clock className="h-3 w-3 text-amber-600 shrink-0" />
                <span className="truncate">{c.contact_name}</span>
              </span>
              <span className="text-amber-600 font-mono shrink-0">{c.minutes_to_due}min</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
