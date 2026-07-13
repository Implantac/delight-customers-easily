import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { suggestRoute } from "@/lib/geo-routes.functions";
import { getRepsOverview } from "@/lib/reps.functions";
import { addProspectAsLead } from "@/lib/geo-prospect.functions";
import { optimizeRouteWithAI } from "@/lib/geo-ai.functions";
import { autoSolveFromRadius } from "@/lib/vrp.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientsMap, type MapPoint } from "@/components/clients-map";
import {
  Route as RouteIcon, Sparkles, Plus, MapPin, Calendar, User,
  Navigation, Clock, TrendingUp, Target, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/geo-rota")({ component: RotaPage });

function RotaPage() {
  const { orgId } = useCurrentOrg();
  const fetchSuggest = useServerFn(suggestRoute);
  const fetchReps = useServerFn(getRepsOverview);
  const optimize = useServerFn(optimizeRouteWithAI);
  const addLead = useServerFn(addProspectAsLead);

  const [repId, setRepId] = useState<string>("all");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);

  const repsQ = useQuery({
    queryKey: ["reps-list", orgId],
    enabled: !!orgId,
    queryFn: () => fetchReps({ data: { organization_id: orgId! } }),
  });

  const suggestQ = useQuery({
    queryKey: ["route-suggest", orgId, city, state],
    enabled: !!orgId,
    queryFn: () =>
      fetchSuggest({
        data: {
          organization_id: orgId!,
          city: city || undefined,
          state: state || undefined,
          limit: 20,
        },
      }),
  });

  const aiM = useMutation({
    mutationFn: async () => {
      if (!suggestQ.data?.route?.length) throw new Error("Sem candidatos para otimizar.");
      return optimize({
        data: {
          organization_id: orgId!,
          start_city: city || undefined,
          candidates: suggestQ.data.route.map((c: any) => ({
            id: c.id,
            name: c.name,
            city: c.city ?? null,
            state: c.state ?? null,
            industry: c.industry ?? null,
            open_value: c.open_value ?? 0,
            won_value: c.won_value ?? 0,
            daysSilent: c.daysSilent ?? 0,
          })),
        },
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao otimizar"),
  });

  const vrpFn = useServerFn(autoSolveFromRadius);
  const [depotLat, setDepotLat] = useState("");
  const [depotLng, setDepotLng] = useState("");
  const vrpM = useMutation({
    mutationFn: async () => {
      const lat = Number(depotLat);
      const lng = Number(depotLng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Informe lat/lng do depot para o solver VRP.");
      }
      return vrpFn({
        data: {
          organization_id: orgId!,
          depot_lat: lat,
          depot_lng: lng,
          radius_km: 25,
          max_stops: 12,
          avg_speed_kmh: 40,
        },
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "VRP falhou"),
  });

  const addM = useMutation({
    mutationFn: (company_id: string) =>
      addLead({ data: { organization_id: orgId!, company_id } }),
    onSuccess: (_d, id) => {
      setAdded((s) => new Set([...s, id]));
      toast.success("Adicionado à rota e ao CRM como Lead.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha"),
  });

  const list = useMemo(() => {
    if (aiM.data?.stops?.length) return aiM.data.stops;
    return suggestQ.data?.route ?? [];
  }, [aiM.data, suggestQ.data]);

  const totalPotential = useMemo(
    () => list.reduce((s: number, c: any) => s + Number(c.open_value ?? 0), 0),
    [list],
  );
  const estMinutes = list.length * 35; // estimativa visita média
  const optimized = !!aiM.data?.stops?.length || !!vrpM.data;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Rota Inteligente do Dia"
        subtitle="A IA monta a melhor sequência de visitas — você só sai para vender."
        icon={Navigation}
      />

      {/* Hero KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> Paradas sugeridas
            </div>
            <div className="text-3xl font-semibold tracking-tight mt-1">{list.length}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {optimized ? "Sequência otimizada pela IA" : "Aguardando otimização"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Potencial em aberto
            </div>
            <div className="text-3xl font-semibold tracking-tight mt-1">
              {totalPotential.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Somatório de oportunidades</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Tempo estimado
            </div>
            <div className="text-3xl font-semibold tracking-tight mt-1">
              {Math.floor(estMinutes / 60)}h{(estMinutes % 60).toString().padStart(2, "0")}
            </div>
            <div className="text-xs text-muted-foreground mt-1">~35 min por visita</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RouteIcon className="h-3.5 w-3.5" /> Distância
            </div>
            <div className="text-3xl font-semibold tracking-tight mt-1">
              {vrpM.data ? `${vrpM.data.total_km.toFixed(1)} km` : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {vrpM.data ? `${vrpM.data.iterations} iter · 2-opt` : "Rode o solver geográfico"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Parâmetros */}
        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Configurar dia
            </CardTitle>
            <CardDescription className="text-xs">
              Quem vai a campo e onde começa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><User className="h-3 w-3" /> Representante</Label>
              <Select value={repId} onValueChange={setRepId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {(repsQ.data?.rows ?? []).map((r: any) => (
                    <SelectItem key={r.user_id} value={r.user_id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Cidade base</Label>
                <Input placeholder="Londrina" value={city} onChange={(e) => setCity(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">UF</Label>
                <Input maxLength={2} placeholder="PR" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className="h-9" />
              </div>
            </div>

            <Separator />

            <Button
              onClick={() => aiM.mutate()}
              disabled={aiM.isPending || !suggestQ.data?.route?.length}
              className="w-full gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {aiM.isPending ? "Otimizando..." : "Otimizar com IA"}
            </Button>
            <Button variant="outline" onClick={() => suggestQ.refetch()} className="w-full">
              Atualizar sugestões
            </Button>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
            >
              <ChevronRight className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
              {showAdvanced ? "Ocultar" : "Mostrar"} solver geográfico
            </button>

            {showAdvanced && (
              <div className="space-y-2 pt-2 border-t">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Depot lat</Label>
                    <Input placeholder="-23.55" value={depotLat} onChange={(e) => setDepotLat(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Depot lng</Label>
                    <Input placeholder="-46.63" value={depotLng} onChange={(e) => setDepotLng(e.target.value)} className="h-9" />
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => vrpM.mutate()} disabled={vrpM.isPending} className="w-full gap-2">
                  <RouteIcon className="h-4 w-4" /> {vrpM.isPending ? "Resolvendo..." : "Resolver rota geográfica"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline de paradas */}
        <div className="space-y-4">
          {aiM.data?.summary && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm leading-relaxed italic text-foreground/90">
                  "{aiM.data.summary}"
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Sequência de visitas</CardTitle>
                <CardDescription className="text-xs">
                  {optimized ? "Otimizada para o seu dia" : "Ordem por proximidade"}
                </CardDescription>
              </div>
              {list.length > 0 && <Badge variant="secondary">{list.length} parada(s)</Badge>}
            </CardHeader>
            <CardContent className="p-0">
              {suggestQ.isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : !list.length ? (
                <div className="p-12 text-center">
                  <MapPin className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
                  <div className="text-sm font-medium">Nenhuma oportunidade na região</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Tente outra cidade ou amplie a UF.
                  </div>
                </div>
              ) : (
                <ol className="relative">
                  {list.map((c: any, i: number) => {
                    const isLast = i === list.length - 1;
                    const isAdded = added.has(c.id);
                    return (
                      <li key={c.id} className="relative flex gap-4 px-5 py-4 hover:bg-muted/40 transition-colors group">
                        {/* Timeline rail */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center ring-2 ring-background z-10">
                            {i + 1}
                          </div>
                          {!isLast && <div className="flex-1 w-px bg-border mt-1" />}
                        </div>

                        <div className="min-w-0 flex-1 pb-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{c.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                                <MapPin className="h-3 w-3" />
                                {[c.city, c.state].filter(Boolean).join(" · ") || "Sem endereço"}
                                {c.industry && <span className="text-muted-foreground/70">· {c.industry}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {typeof c.score === "number" && (
                                <Badge variant="outline" className="text-xs h-5">★ {Math.round(c.score)}</Badge>
                              )}
                              {Number(c.open_value) > 0 && (
                                <Badge variant="secondary" className="text-xs h-5 font-mono">
                                  {Number(c.open_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {c.reason && (
                            <div className="text-xs text-primary/80 mt-2 flex items-start gap-1.5">
                              <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>{c.reason}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant={isAdded ? "secondary" : "outline"}
                              disabled={isAdded || addM.isPending}
                              onClick={() => addM.mutate(c.id)}
                              className="h-7 gap-1 text-xs"
                            >
                              <Plus className="h-3 w-3" /> {isAdded ? "Na rota" : "Adicionar"}
                            </Button>
                            {(c.city || c.state) && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.name} ${c.city ?? ""} ${c.state ?? ""}`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                              >
                                <Navigation className="h-3 w-3" /> Abrir no mapa
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          {vrpM.data && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RouteIcon className="h-4 w-4 text-primary" /> Rota geográfica resolvida
                </CardTitle>
                <CardDescription className="text-xs">
                  {vrpM.data.ordered.length} paradas · {vrpM.data.total_km.toFixed(2)} km ·
                  {" "}{vrpM.data.est_duration_min} min · {vrpM.data.iterations} iterações
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-1 text-sm">
                  {vrpM.data.ordered.map((s, i) => (
                    <li key={s.id} className="flex justify-between items-center py-1.5 border-b last:border-0">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="h-5 text-xs">{i + 1}</Badge>
                        {s.label ?? s.id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {s.lat.toFixed(3)}, {s.lng.toFixed(3)}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
