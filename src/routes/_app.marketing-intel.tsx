import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getMarketingIntel } from "@/lib/marketing-intel.functions";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Megaphone, TrendingUp, Users, Flame, Sparkles, ArrowRight, Mail, Eye, MousePointerClick,
  Trophy, Download,
} from "lucide-react";
import { toCSV, downloadCSV } from "@/lib/csv-export";

export const Route = createFileRoute("/_app/marketing-intel")({
  component: MarketingIntelPage,
});

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toFixed(1)}%`;

function MarketingIntelPage() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(getMarketingIntel);
  const [windowDays, setWindowDays] = useState<string>("90");

  const { data, isLoading } = useQuery({
    queryKey: ["marketing-intel", orgId, windowDays],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId!, window_days: Number(windowDays) } }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Intelligence"
        subtitle="De campanha a receita: o que de fato traz cliente e quanto custa."
        icon={Megaphone}
      />

      <NextActionBlock surface="marketing-intel" title="Ações sugeridas pela IA" />

      <div className="flex justify-between items-center">
        <div className="text-xs text-muted-foreground">
          Janela analisada — últimos {windowDays} dias
        </div>
        <Select value={windowDays} onValueChange={setWindowDays}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
            <SelectItem value="180">180 dias</SelectItem>
            <SelectItem value="365">12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi loading={isLoading} label="Leads captados" value={data?.summary.total_leads ?? 0} icon={Users} />
        <Kpi loading={isLoading} label="Convertidos" value={data?.summary.total_converted ?? 0} icon={Flame} tone="ok" />
        <Kpi loading={isLoading} label="Receita gerada" value={data ? fmt(data.summary.total_won_revenue) : "—"} icon={TrendingUp} tone="ok" />
        <Kpi loading={isLoading} label="Pipeline aberto" value={data ? fmt(data.summary.total_pipeline) : "—"} icon={TrendingUp} />
        <Kpi loading={isLoading} label="Visitas influencer" value={data?.summary.total_visits ?? 0} icon={Sparkles} />
      </div>

      <ChannelInsight channels={data?.channels ?? []} loading={isLoading} />

      <Tabs defaultValue="canais" className="space-y-4">
        <TabsList>
          <TabsTrigger value="canais">Canais</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="influencers">Influencers</TabsTrigger>
        </TabsList>

        <TabsContent value="canais">
          {(data?.channels?.length ?? 0) > 0 && (
            <div className="flex justify-end mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const csv = toCSV(
                    data!.channels.map((c) => ({
                      canal: c.channel,
                      leads: c.leads,
                      convertidos: c.converted,
                      taxa_pct: c.conversion_rate.toFixed(2),
                      pipeline_aberto: c.open_pipeline,
                      receita_ganha: c.won_revenue,
                      receita_por_lead: c.leads > 0 ? (c.won_revenue / c.leads).toFixed(2) : "0",
                    })),
                    [
                      { key: "canal", label: "Canal" },
                      { key: "leads", label: "Leads" },
                      { key: "convertidos", label: "Convertidos" },
                      { key: "taxa_pct", label: "Conversão %" },
                      { key: "pipeline_aberto", label: "Pipeline (BRL)" },
                      { key: "receita_ganha", label: "Receita (BRL)" },
                      { key: "receita_por_lead", label: "Receita por lead (BRL)" },
                    ],
                  );
                  const date = new Date().toISOString().slice(0, 10);
                  downloadCSV(`marketing-canais-${windowDays}d-${date}.csv`, csv);
                }}
              >
                <Download className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            </div>
          )}
          {isLoading ? <Skeleton className="h-60 w-full" /> : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Canal</th>
                    <th className="text-right px-3 py-2">Leads</th>
                    <th className="text-right px-3 py-2">Convertidos</th>
                    <th className="text-right px-3 py-2">Taxa</th>
                    <th className="text-right px-3 py-2">Pipeline</th>
                    <th className="text-right px-3 py-2">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.channels ?? []).map((c) => (
                    <tr key={c.channel} className="border-t">
                      <td className="px-3 py-2 font-medium capitalize">{c.channel}</td>
                      <td className="px-3 py-2 text-right">{c.leads}</td>
                      <td className="px-3 py-2 text-right">{c.converted}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={c.conversion_rate >= 20 ? "text-emerald-600" : c.conversion_rate >= 5 ? "text-amber-600" : "text-muted-foreground"}>
                          {pct(c.conversion_rate)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(c.open_pipeline)}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-600">{fmt(c.won_revenue)}</td>
                    </tr>
                  ))}
                  {!data?.channels.length && (
                    <tr><td colSpan={6} className="text-center p-8 text-muted-foreground text-sm">
                      Nenhum lead capturado nessa janela.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="campanhas">
          {isLoading ? <Skeleton className="h-60 w-full" /> : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Campanha</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-right px-3 py-2"><Mail className="h-3 w-3 inline" /> Enviados</th>
                    <th className="text-right px-3 py-2"><Eye className="h-3 w-3 inline" /> Abertura</th>
                    <th className="text-right px-3 py-2"><MousePointerClick className="h-3 w-3 inline" /> Clique</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.campaigns ?? []).map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-2 font-medium truncate max-w-[300px]">{c.name}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{c.status}</Badge></td>
                      <td className="px-3 py-2 text-right">{c.sent}</td>
                      <td className="px-3 py-2 text-right">{pct(c.open_rate)}</td>
                      <td className="px-3 py-2 text-right">{pct(c.click_rate)}</td>
                    </tr>
                  ))}
                  {!data?.campaigns.length && (
                    <tr><td colSpan={5} className="text-center p-8 text-muted-foreground text-sm">
                      Nenhuma campanha cadastrada.
                    </td></tr>
                  )}
                </tbody>
              </table>
              <div className="border-t p-2 flex justify-end">
                <Button asChild size="sm" variant="ghost" className="gap-1">
                  <Link to="/campaigns">Abrir campanhas <ArrowRight className="h-3 w-3" /></Link>
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="influencers">
          {isLoading ? <Skeleton className="h-60 w-full" /> : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Influencer</th>
                    <th className="text-left px-3 py-2">Plataforma</th>
                    <th className="text-right px-3 py-2">Visitas</th>
                    <th className="text-right px-3 py-2">Conversões</th>
                    <th className="text-right px-3 py-2">CVR</th>
                    <th className="text-right px-3 py-2">Receita</th>
                    <th className="text-right px-3 py-2">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.influencers ?? []).map((i) => (
                    <tr key={i.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{i.name}</div>
                        {i.handle && <div className="text-xs text-muted-foreground">@{i.handle}</div>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground capitalize">{i.platform ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{i.visits}</td>
                      <td className="px-3 py-2 text-right">{i.conversions}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={i.cvr >= 5 ? "text-emerald-600" : "text-muted-foreground"}>{pct(i.cvr)}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-600">{fmt(i.revenue)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(i.commission)}</td>
                    </tr>
                  ))}
                  {!data?.influencers.length && (
                    <tr><td colSpan={7} className="text-center p-8 text-muted-foreground text-sm">
                      Nenhum influencer cadastrado.
                    </td></tr>
                  )}
                </tbody>
              </table>
              <div className="border-t p-2 flex justify-end">
                <Button asChild size="sm" variant="ghost" className="gap-1">
                  <Link to="/influencers">Gerenciar <ArrowRight className="h-3 w-3" /></Link>
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  label, value, icon: Icon, tone, loading,
}: {
  label: string; value: string | number; icon: typeof Megaphone;
  tone?: "ok" | "warn" | "danger"; loading?: boolean;
}) {
  const color =
    tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-amber-600"
    : tone === "ok" ? "text-emerald-600"
    : "text-primary";
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

type ChannelRow = { channel: string; leads: number; converted: number; conversion_rate: number; open_pipeline: number; won_revenue: number };

function ChannelInsight({ channels, loading }: { channels: ChannelRow[]; loading: boolean }) {
  const insight = useMemo(() => {
    if (!channels.length) return null;
    const withRPL = channels.map((c) => ({ ...c, rpl: c.leads > 0 ? c.won_revenue / c.leads : 0 }));
    const topRevenue = [...withRPL].sort((a, b) => b.won_revenue - a.won_revenue)[0];
    const topCVR = [...withRPL].filter((c) => c.leads >= 3).sort((a, b) => b.conversion_rate - a.conversion_rate)[0] ?? topRevenue;
    const topRPL = [...withRPL].filter((c) => c.leads >= 3).sort((a, b) => b.rpl - a.rpl)[0] ?? topRevenue;
    return { topRevenue, topCVR, topRPL };
  }, [channels]);

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!insight) return null;

  return (
    <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Onde focar agora</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <InsightCell icon={Trophy} label="Mais receita" channel={insight.topRevenue.channel} value={fmt(insight.topRevenue.won_revenue)} hint="canal que mais converteu em R$" />
        <InsightCell icon={Flame} label="Maior taxa" channel={insight.topCVR.channel} value={pct(insight.topCVR.conversion_rate)} hint="melhor eficiência de funil" />
        <InsightCell icon={TrendingUp} label="Melhor R$/lead" channel={insight.topRPL.channel} value={fmt(insight.topRPL.rpl)} hint="onde cada lead vale mais" />
      </div>
    </Card>
  );
}

function InsightCell({ icon: Icon, label, channel, value, hint }: { icon: typeof Trophy; label: string; channel: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border bg-card/70 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="font-medium capitalize mt-1">{channel}</div>
      <div className="text-primary font-mono text-sm">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
    </div>
  );
}
