import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { getGeoOverview, suggestRoute } from "@/lib/geo-routes.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Route as RouteIcon, Building, TrendingUp, Compass, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_app/geo")({ component: GeoPage });

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Geointeligência"
        subtitle="Onde estão seus clientes, onde está o pipeline aberto e qual a melhor rota pra hoje."
        icon={MapPin}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI loading={isLoading} label="Clientes" value={data?.summary.total ?? 0} icon={Building} />
        <KPI loading={isLoading} label="Com localização" value={data?.summary.with_location ?? 0} icon={MapPin} />
        <KPI loading={isLoading} label="Com coordenadas" value={data?.summary.with_coords ?? 0} icon={Compass} />
        <KPI loading={isLoading} label="Pipeline aberto" value={data ? fmt(data.summary.open_value) : "—"} icon={TrendingUp} tone="ok" />
      </div>

      <Tabs defaultValue="cidades" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cidades">Por cidade</TabsTrigger>
          <TabsTrigger value="estados">Por estado</TabsTrigger>
          <TabsTrigger value="rota">Rota sugerida</TabsTrigger>
        </TabsList>

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
          </Card>

          {routeQ.isLoading ? <Skeleton className="h-40 w-full" /> : (
            <div className="space-y-2">
              {routeQ.data?.route.length === 0 && (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  Sem clientes nessa região. Tente outro filtro ou complete os endereços.
                </Card>
              )}
              {routeQ.data?.route.map((r, i) => (
                <Card key={r.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">{i + 1}</div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[r.city, r.state].filter(Boolean).join(" · ") || "sem endereço"}
                        {r.industry && ` · ${r.industry}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end text-xs">
                      <span className="font-mono">{fmt(r.open_value)}</span>
                      <span className="text-muted-foreground">{r.daysSilent}d sem contato</span>
                    </div>
                    <Badge variant="secondary">{Math.round(r.score)}</Badge>
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
