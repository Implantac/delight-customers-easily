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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Route as RouteIcon, Sparkles, Plus, MapPin, Calendar, User } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Oportunidades na Rota"
        subtitle="Selecione o representante e a data. A IA monta a melhor sequência de visitas do dia."
        icon={RouteIcon}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parâmetros da rota</CardTitle>
          <CardDescription>Quem vai a campo e onde começa o dia.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Representante</Label>
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(repsQ.data?.rows ?? []).map((r: any) => (
                  <SelectItem key={r.user_id} value={r.user_id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cidade base</Label>
            <Input placeholder="Ex: Londrina" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">UF</Label>
            <Input maxLength={2} placeholder="PR" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Depot lat (VRP)</Label>
            <Input placeholder="-23.5505" value={depotLat} onChange={(e) => setDepotLat(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Depot lng (VRP)</Label>
            <Input placeholder="-46.6333" value={depotLng} onChange={(e) => setDepotLng(e.target.value)} />
          </div>
          <div className="md:col-span-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => suggestQ.refetch()}>Atualizar</Button>
            <Button variant="outline" onClick={() => vrpM.mutate()} disabled={vrpM.isPending} className="gap-2">
              <RouteIcon className="h-4 w-4" /> {vrpM.isPending ? "Resolvendo..." : "Solver VRP (geo)"}
            </Button>
            <Button onClick={() => aiM.mutate()} disabled={aiM.isPending || !suggestQ.data?.route?.length} className="gap-2">
              <Sparkles className="h-4 w-4" /> {aiM.isPending ? "Otimizando..." : "Otimizar com IA"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {vrpM.data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rota VRP geográfica</CardTitle>
            <CardDescription>
              {vrpM.data.ordered.length} paradas · {vrpM.data.total_km.toFixed(2)} km ·
              {" "}{vrpM.data.est_duration_min} min · 2-opt em {vrpM.data.iterations} iter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1 text-sm">
              {vrpM.data.ordered.map((s, i) => (
                <li key={s.id} className="flex justify-between border-b pb-1">
                  <span><Badge variant="outline" className="mr-2">{i + 1}</Badge>{s.label ?? s.id.slice(0, 8)}</span>
                  <span className="text-xs text-muted-foreground">{s.lat.toFixed(3)}, {s.lng.toFixed(3)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            Visitas sugeridas
            {list.length > 0 && <Badge variant="secondary">{list.length} parada(s)</Badge>}
          </CardTitle>
          {aiM.data?.summary && (
            <CardDescription className="italic">"{aiM.data.summary}"</CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {suggestQ.isLoading ? (
            <div className="p-6"><Skeleton className="h-32 w-full" /></div>
          ) : !list.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma oportunidade próxima encontrada. Tente ampliar a cidade ou UF.
            </div>
          ) : (
            <ol className="divide-y">
              {list.map((c: any, i: number) => (
                <li key={c.id} className="flex items-center gap-3 p-3">
                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 truncate">
                      <MapPin className="h-3 w-3" />
                      {[c.city, c.state].filter(Boolean).join(" · ") || "—"}
                      {c.industry && <span>· {c.industry}</span>}
                    </div>
                    {c.reason && <div className="text-xs text-primary/80 mt-1">{c.reason}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {typeof c.score === "number" && (
                      <Badge variant="outline" className="text-xs">Score {Math.round(c.score)}</Badge>
                    )}
                    <Button
                      size="sm"
                      variant={added.has(c.id) ? "secondary" : "ghost"}
                      disabled={added.has(c.id) || addM.isPending}
                      onClick={() => addM.mutate(c.id)}
                      className="gap-1"
                    >
                      <Plus className="h-3 w-3" /> {added.has(c.id) ? "Na rota" : "Adicionar à rota"}
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
