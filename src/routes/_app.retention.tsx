import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getRetentionInsights } from "@/lib/churn.functions";
import { getRetentionPlan, type RetentionAction } from "@/lib/retention-ai.functions";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, AlertTriangle, AlertCircle, TrendingUp, Building2, Sparkles, Loader2, MessageCircle, Phone, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/retention")({ component: RetentionPage });

const CHANNEL_ICON = { whatsapp: MessageCircle, ligacao: Phone, email: Mail, visita: MapPin } as const;
const CHANNEL_LABEL = { whatsapp: "WhatsApp", ligacao: "Ligação", email: "E-mail", visita: "Visita" } as const;
const PRIORITY_TONE: Record<string, string> = {
  alta: "bg-rose-500/15 text-rose-600 border-rose-500/30",
  media: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  baixa: "bg-muted text-muted-foreground",
};

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function RetentionPage() {
  const { orgId } = useCurrentOrg();
  const fn = useServerFn(getRetentionInsights);
  const { data, isLoading } = useQuery({
    queryKey: ["retention", orgId],
    enabled: !!orgId,
    queryFn: () => fn({ data: { organization_id: orgId! } }),
  });

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 md:grid-cols-4">{[0,1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const { rows, summary } = data;
  const atRisk = rows.filter((r) => r.level === "risco");
  const expansion = rows.filter((r) => r.expansion_signals.length > 0);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Retenção & Expansão"
        subtitle="Quem corre risco de churn e onde estão as oportunidades de crescer dentro da base."
      />

      <NextActionBlock surface="retention" title="Reter e expandir agora" showRegenerate />


      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={Heart} label="Saudáveis" value={summary.saudaveis} tone="emerald" />
        <Kpi icon={AlertTriangle} label="Atenção" value={summary.atencao} tone="amber" />
        <Kpi icon={AlertCircle} label="Em risco" value={summary.em_risco} tone="rose" />
        <Kpi icon={TrendingUp} label="Sinais de expansão" value={summary.expansion_opportunities} tone="primary" />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-500" />
          Clientes em risco ({atRisk.length})
        </h3>
        {atRisk.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente em risco de churn no momento.</p>
        ) : (
          <div className="space-y-2">
            {atRisk.map((r) => <RiskRow key={r.company_id} row={r} />)}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Oportunidades de expansão ({expansion.length})
        </h3>
        {expansion.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem sinais claros de expansão. Volte após registrar mais negócios.</p>
        ) : (
          <div className="space-y-2">
            {expansion.slice(0, 20).map((r) => (
              <div key={r.company_id} className="flex items-start gap-3 p-3 rounded-md border bg-background">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <Link to="/companies/$id" params={{ id: r.company_id }} className="font-medium text-sm hover:underline">
                    {r.name}
                  </Link>
                  <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                    {r.expansion_signals.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
                <Badge variant="outline" className="text-emerald-600">
                  {fmt(r.won_value)} ganho
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Todos os clientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2 font-medium">Empresa</th>
                <th className="text-left py-2 font-medium">Setor</th>
                <th className="text-right py-2 font-medium">Risco</th>
                <th className="text-right py-2 font-medium">Sem contato</th>
                <th className="text-right py-2 font-medium">Ganho</th>
                <th className="text-right py-2 font-medium">Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.company_id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2">
                    <Link to="/companies/$id" params={{ id: r.company_id }} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2 text-muted-foreground">{r.industry ?? "—"}</td>
                  <td className="py-2 text-right">
                    <Badge variant={r.level === "risco" ? "destructive" : r.level === "atencao" ? "secondary" : "outline"}>
                      {r.risk}
                    </Badge>
                  </td>
                  <td className="py-2 text-right">{r.days_silent != null ? `${r.days_silent}d` : "—"}</td>
                  <td className="py-2 text-right">{fmt(r.won_value)}</td>
                  <td className="py-2 text-right">{fmt(r.open_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: any) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-500", amber: "text-amber-500", rose: "text-rose-500", primary: "text-primary",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </Card>
  );
}

function RiskRow({ row }: { row: any }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-md border bg-rose-500/5 border-rose-500/20">
      <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5" />
      <div className="flex-1 min-w-0">
        <Link to="/companies/$id" params={{ id: row.company_id }} className="font-medium text-sm hover:underline">
          {row.name}
        </Link>
        <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
          {row.reasons.map((r: string, i: number) => <li key={i}>• {r}</li>)}
        </ul>
      </div>
      <div className="text-right">
        <Badge variant="destructive">{row.risk}</Badge>
      </div>
    </div>
  );
}
