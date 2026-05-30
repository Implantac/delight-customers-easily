import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getInfluencerMetrics } from "@/lib/influencer-tracking.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Target, DollarSign, TrendingUp } from "lucide-react";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function InfluencerMetricsPanel() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(getInfluencerMetrics);
  const q = useQuery({
    queryKey: ["influencer-metrics", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
    staleTime: 60_000,
  });

  if (q.isLoading || !q.data) {
    return <Skeleton className="h-32 w-full" />;
  }
  const { totals, influencers } = q.data;
  const netRoi = totals.commission > 0
    ? Math.round(((totals.revenue - totals.commission) / totals.commission) * 100)
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Visitas 90d" value={totals.visits.toLocaleString("pt-BR")} icon={Eye} />
        <KPI label="Conversões 90d" value={(totals.leads + totals.deals).toLocaleString("pt-BR")} icon={Target} />
        <KPI label="Receita 90d" value={fmtBRL(totals.revenue)} icon={DollarSign} tone="ok" />
        <KPI label="ROI líquido" value={netRoi == null ? "—" : `${netRoi}%`} icon={TrendingUp} tone={netRoi != null && netRoi > 0 ? "ok" : undefined} />
      </div>

      {influencers.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 text-xs uppercase font-semibold text-muted-foreground">
            Performance por influenciador (90 dias)
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/10 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Influenciador</th>
                <th className="text-right px-3 py-2">Visitas</th>
                <th className="text-right px-3 py-2">Conv %</th>
                <th className="text-right px-3 py-2">Leads</th>
                <th className="text-right px-3 py-2">Negócios</th>
                <th className="text-right px-3 py-2">Receita</th>
                <th className="text-right px-3 py-2">Comissão</th>
                <th className="text-right px-3 py-2">ROI</th>
              </tr>
            </thead>
            <tbody>
              {influencers.map((r) => {
                const dead = r.visits_90d >= 50 && r.revenue_90d === 0;
                return (
                  <tr key={r.id} className={`border-t ${dead ? "bg-destructive/5" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground">@{(r.handle ?? "").replace(/^@/, "")} · {r.platform}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{r.visits_90d}</td>
                    <td className="px-3 py-2 text-right">{r.conversion_rate}%</td>
                    <td className="px-3 py-2 text-right">{r.leads_90d}</td>
                    <td className="px-3 py-2 text-right">{r.deals_90d}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-600">{fmtBRL(r.revenue_90d)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtBRL(r.commission_90d)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.roi == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant={r.roi > 0 ? "default" : "destructive"}>{r.roi}%</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function KPI({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone?: "ok" }) {
  const color = tone === "ok" ? "text-emerald-600" : "text-primary";
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className={`text-xl font-semibold mt-1 ${color}`}>{value}</div>
    </Card>
  );
}
