import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getMarketingOverview, updateLeadStatus, CHANNELS, type MarketingLead } from "@/lib/marketing.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, Inbox, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/marketing")({ component: MarketingPage });

const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.id, c.label]));

function statusBadge(s: MarketingLead["status"]) {
  if (s === "new") return <Badge variant="secondary">novo</Badge>;
  if (s === "qualified") return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">qualificado</Badge>;
  if (s === "converted") return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">convertido</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">descartado</Badge>;
}

function MarketingPage() {
  const { orgId } = useCurrentOrg();
  const qc = useQueryClient();
  const run = useServerFn(getMarketingOverview);
  const update = useServerFn(updateLeadStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["marketing", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
  });

  const mut = useMutation({
    mutationFn: (vars: { id: string; status: MarketingLead["status"] }) => update({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", orgId] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Intelligence"
        subtitle="Leads de todos os canais num só inbox — WhatsApp, redes sociais, Google e LPs."
        icon={Megaphone}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI loading={isLoading} label="Leads 30d" value={data?.summary.total_30d ?? 0} icon={Inbox} />
        <KPI loading={isLoading} label="Novos" value={data?.summary.new_count ?? 0} icon={Sparkles} tone="warn" />
        <KPI loading={isLoading} label="Qualificados" value={data?.summary.qualified_count ?? 0} icon={CheckCircle2} />
        <KPI loading={isLoading} label="Convertidos" value={data?.summary.converted_count ?? 0} icon={CheckCircle2} tone="ok" />
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Performance por canal (30d)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(data?.byChannel ?? []).map((c) => (
            <div key={c.channel} className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">{CHANNEL_LABEL[c.channel] ?? c.channel}</div>
              <div className="text-lg font-semibold">{c.total}</div>
              <div className="text-xs">
                <span className="text-emerald-600 font-mono">{c.converted}</span>
                <span className="text-muted-foreground"> convertidos · {c.conversion_pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-3 py-2 border-b text-sm font-semibold">Inbox de leads</div>
        {isLoading ? <div className="p-3 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Quando</th>
                <th className="text-left px-3 py-2">Canal</th>
                <th className="text-left px-3 py-2">Origem</th>
                <th className="text-left px-3 py-2">Contato</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Mensagem</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recent ?? []).map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{CHANNEL_LABEL[l.channel] ?? l.channel}</Badge></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{l.source ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{[l.email, l.phone].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-3 py-2 text-xs max-w-xs truncate hidden md:table-cell">{l.message ?? "—"}</td>
                  <td className="px-3 py-2">{statusBadge(l.status)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" disabled={mut.isPending || l.status === "qualified"} onClick={() => mut.mutate({ id: l.id, status: "qualified" })}>Qualificar</Button>
                      <Button size="sm" variant="ghost" disabled={mut.isPending || l.status === "discarded"} onClick={() => mut.mutate({ id: l.id, status: "discarded" })}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!data?.recent.length && (
                <tr><td colSpan={7} className="text-center p-8 text-muted-foreground text-sm">
                  Sem leads ainda. Conecte WhatsApp, Instagram ou crie uma Landing Page para começar a capturar.
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function KPI({ label, value, icon: Icon, tone, loading }: { label: string; value: string | number; icon: typeof Inbox; tone?: "ok" | "warn"; loading?: boolean }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-primary";
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <div className={`text-xl font-semibold mt-1 ${color}`}>{value}</div>}
    </Card>
  );
}
