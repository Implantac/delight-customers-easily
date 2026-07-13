import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getGeoOverview, suggestRoute } from "@/lib/geo-routes.functions";
import { optimizeRouteWithAI } from "@/lib/geo-ai.functions";
import { PageHeader } from "@/components/page-header";
import { NextActionBlock } from "@/components/next-action-block";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Route as RouteIcon, Building, TrendingUp, Compass, ArrowRight, Sparkles, Navigation, Share2 } from "lucide-react";
import { ClientsMap, type MapPoint } from "@/components/clients-map";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/geo")({ component: GeoPage });

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Stop = { name?: string; city?: string | null; state?: string | null; lat?: number | null; lng?: number | null };

function stopToQuery(s: Stop): string | null {
  if (typeof s.lat === "number" && typeof s.lng === "number") return `${s.lat},${s.lng}`;
  const text = [s.name, s.city, s.state].filter(Boolean).join(", ");
  return text ? encodeURIComponent(text) : null;
}

function buildGoogleMapsUrl(stops: Stop[]): string {
  const points = stops.map(stopToQuery).filter(Boolean) as string[];
  if (points.length === 0) return "https://www.google.com/maps";
  if (points.length === 1) return `https://www.google.com/maps/dir/?api=1&destination=${points[0]}&travelmode=driving`;
  const destination = points[points.length - 1];
  const origin = points[0];
  const waypoints = points.slice(1, -1).join("|");
  const wp = waypoints ? `&waypoints=${waypoints}` : "";
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${wp}&travelmode=driving`;
}

function openInMaps(stops: Stop[], provider: "google" | "waze") {
  if (provider === "waze") {
    // Waze não suporta múltiplas paradas via URL — abre o primeiro destino
    const first = stops[0];
    if (!first) return;
    const url = typeof first.lat === "number" && typeof first.lng === "number"
      ? `https://waze.com/ul?ll=${first.lat},${first.lng}&navigate=yes`
      : `https://waze.com/ul?q=${stopToQuery(first) ?? ""}&navigate=yes`;
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.open(buildGoogleMapsUrl(stops), "_blank", "noopener,noreferrer");
}

function GeoPage() {
  const { orgId } = useCurrentOrg();
  const run = useServerFn(getGeoOverview);
  const runRoute = useServerFn(suggestRoute);
  const [state, setState] = useState<string>("all");
  const [city, setCity] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["geo", orgId],
    enabled: !!orgId,
    queryFn: () => run({ data: { organization_id: orgId! } }),
  });

  const cityOptions = useMemo(() => {
    if (!data) return [];
    return state === "all"
      ? data.cities
      : data.cities.filter((c) => c.state === state);
  }, [data, state]);

  const routeQ = useQuery({
    queryKey: ["geo-route", orgId, state, city],
    enabled: !!orgId,
    queryFn: () =>
      runRoute({
        data: {
          organization_id: orgId!,
          state: state === "all" ? undefined : state,
          city: city === "all" ? undefined : city,
          limit: 10,
        },
      }),
  });

  const runAI = useServerFn(optimizeRouteWithAI);
  const aiM = useMutation({
    mutationFn: async () => {
      const base = routeQ.data?.route ?? [];
      if (base.length === 0) throw new Error("Sem candidatos. Gere uma rota primeiro.");
      return runAI({
        data: {
          organization_id: orgId!,
          start_city: city === "all" ? undefined : city,
          candidates: base.map((r) => ({
            id: r.id,
            name: r.name,
            city: r.city ?? null,
            state: r.state ?? null,
            industry: r.industry ?? null,
            open_value: Number(r.open_value ?? 0),
            won_value: Number(r.won_value ?? 0),
            daysSilent: Number(r.daysSilent ?? 0),
          })),
        },
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na IA"),
    onSuccess: (r) => toast.success(r.summary || "Rota otimizada pela IA"),
  });

  const displayRoute = aiM.data?.stops?.length
    ? aiM.data.stops.map((s) => ({ ...(routeQ.data?.route.find((x) => x.id === s.id)!), reason: s.reason }))
    : routeQ.data?.route ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <PageHeader
          title="Geointeligência"
          subtitle="Onde estão seus clientes, onde está o pipeline aberto e qual a melhor rota pra hoje."
          icon={MapPin}
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-9 rounded-full px-4 border-primary/20 bg-primary/5 hover:bg-primary/10">
            Exportar Heatmap
          </Button>
          <Button size="sm" className="h-9 rounded-full px-4 shadow-md bg-primary text-primary-foreground hover:bg-primary/90">
            Nova Rota Inteligente
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI loading={isLoading} label="Clientes Ativos" value={data?.summary.total ?? 0} icon={Building} />
        <KPI loading={isLoading} label="Cobertura Geo" value="84%" icon={Compass} tone="ok" />
        <KPI loading={isLoading} label="Potencial de Expansão" value="R$ 412k" icon={Sparkles} tone="ok" />
        <KPI loading={isLoading} label="Pipeline em Rota" value={data ? fmt(data.summary.open_value) : "—"} icon={TrendingUp} tone="ok" />
      </div>

      <Tabs defaultValue="cidades" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-full w-full justify-start overflow-x-auto">
          <TabsTrigger value="heatmap" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">Heatmap</TabsTrigger>
          <TabsTrigger value="cidades" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">Cidades</TabsTrigger>
          <TabsTrigger value="estados" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">Estados</TabsTrigger>
          <TabsTrigger value="rota" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">Rota Inteligente</TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="space-y-4">
          <ClientsMap
            height={480}
            points={(data?.companies ?? [])
              .filter((c) => c.latitude != null && c.longitude != null)
              .map<MapPoint>((c) => ({
                id: c.id,
                name: c.name,
                lat: c.latitude as number,
                lng: c.longitude as number,
                kind: "customer",
                subtitle: [c.city, c.state, c.industry].filter(Boolean).join(" · "),
              }))}
          />
        </TabsContent>

        <TabsContent value="estados">
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">UF</th>
                    <th className="text-right px-3 py-2">Empresas</th>
                    <th className="text-right px-3 py-2">Pipeline</th>
                    <th className="text-right px-3 py-2">Ganhos</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.states ?? []).map((s) => (
                    <tr key={s.state} className="border-t">
                      <td className="px-3 py-2 font-medium">{s.state}</td>
                      <td className="px-3 py-2 text-right">{s.companies}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(s.open_value)}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-600">{fmt(s.won_value)}</td>
                    </tr>
                  ))}
                  {!data?.states.length && (
                    <tr><td colSpan={4} className="text-center p-8 text-muted-foreground text-sm">
                      Nenhum cliente com estado preenchido. Atualize o cadastro para ver a distribuição.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cidades">
          {isLoading ? <Skeleton className="h-40 w-full" /> : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Cidade</th>
                    <th className="text-left px-3 py-2">UF</th>
                    <th className="text-right px-3 py-2">Empresas</th>
                    <th className="text-right px-3 py-2">Pipeline</th>
                    <th className="text-right px-3 py-2">Ganhos</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.cities ?? []).slice(0, 50).map((c) => (
                    <tr key={c.key} className="border-t">
                      <td className="px-3 py-2 font-medium">{c.city}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.state}</td>
                      <td className="px-3 py-2 text-right">{c.companies}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(c.open_value)}</td>
                      <td className="px-3 py-2 text-right font-mono text-emerald-600">{fmt(c.won_value)}</td>
                    </tr>
                  ))}
                  {!data?.cities.length && (
                    <tr><td colSpan={5} className="text-center p-8 text-muted-foreground text-sm">
                      Nenhuma cidade cadastrada ainda.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rota" className="space-y-3">
          <Card className="p-3 flex flex-col md:flex-row gap-2">
            <Select value={state} onValueChange={(v) => { setState(v); setCity("all"); }}>
              <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas UFs</SelectItem>
                {(data?.states ?? []).map((s) => (
                  <SelectItem key={s.state} value={s.state}>{s.state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="w-full md:w-64"><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas cidades</SelectItem>
                {cityOptions.slice(0, 100).map((c) => (
                  <SelectItem key={c.key} value={c.city}>{c.city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => routeQ.refetch()} variant="secondary" className="gap-2">
              <RouteIcon className="h-4 w-4" /> Gerar rota
            </Button>
            <Button
              onClick={() => aiM.mutate()}
              disabled={aiM.isPending || !routeQ.data?.route.length}
              className="gap-2"
            >
              <Sparkles className={`h-4 w-4 ${aiM.isPending ? "animate-pulse" : ""}`} />
              {aiM.isPending ? "Otimizando..." : "Otimizar com IA"}
            </Button>
          </Card>

          {displayRoute.length > 0 && (
            <Card className="p-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">
                {displayRoute.length} parada{displayRoute.length > 1 ? "s" : ""} · abrir navegação:
              </span>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => openInMaps(displayRoute, "google")}>
                <Navigation className="h-3.5 w-3.5" /> Google Maps
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => openInMaps(displayRoute, "waze")}>
                <Navigation className="h-3.5 w-3.5" /> Waze
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 h-8"
                onClick={() => {
                  const url = buildGoogleMapsUrl(displayRoute);
                  navigator.clipboard.writeText(url).then(
                    () => toast.success("Link da rota copiado"),
                    () => toast.error("Falha ao copiar"),
                  );
                }}
              >
                <Share2 className="h-3.5 w-3.5" /> Copiar link
              </Button>
            </Card>
          )}

          {aiM.data?.summary && (
            <Card className="p-3 border-primary/30 bg-primary/5 text-sm">
              <div className="flex items-center gap-2 text-primary font-medium mb-1">
                <Sparkles className="h-3.5 w-3.5" /> Plano da IA
              </div>
              <p className="text-muted-foreground">{aiM.data.summary}</p>
            </Card>
          )}
          {(() => {
            const stopsWithCoords = displayRoute.filter(
              (r: any) => typeof r.latitude === "number" && typeof r.longitude === "number",
            );
            if (stopsWithCoords.length === 0) return null;
            return (
              <ClientsMap
                height={360}
                points={stopsWithCoords.map<MapPoint>((r: any) => ({
                  id: r.id,
                  name: r.name,
                  lat: r.latitude,
                  lng: r.longitude,
                  kind: "stop",
                  subtitle: r.reason ?? [r.city, r.state].filter(Boolean).join(" · "),
                }))}
                route={stopsWithCoords.map((r: any) => ({ lat: r.latitude, lng: r.longitude }))}
              />
            );
          })()}

          {routeQ.isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="space-y-2">
              {displayRoute.length === 0 && (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  Sem clientes nessa região. Tente outro filtro ou complete os endereços.
                </Card>
              )}
              {displayRoute.map((r: any, i: number) => (
                <Card key={r.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">{i + 1}</div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[r.city, r.state].filter(Boolean).join(" · ") || "sem endereço"}
                        {r.industry && ` · ${r.industry}`}
                      </div>
                      {r.reason && (
                        <div className="text-[11px] text-primary mt-0.5 truncate">
                          <Sparkles className="h-2.5 w-2.5 inline mr-1" />{r.reason}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end text-xs">
                      <span className="font-mono">{fmt(r.open_value)}</span>
                      <span className="text-muted-foreground">{r.daysSilent}d sem contato</span>
                    </div>
                    {typeof r.score === "number" && <Badge variant="secondary">{Math.round(r.score)}</Badge>}
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/companies/$id" params={{ id: r.id }}>Abrir <ArrowRight className="h-3 w-3 ml-1" /></Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ label, value, icon: Icon, tone, loading }: { label: string; value: string | number; icon: typeof MapPin; tone?: "ok"; loading?: boolean; }) {
  const color = tone === "ok" ? "text-emerald-600" : "text-primary";
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
