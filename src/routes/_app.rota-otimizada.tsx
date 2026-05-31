import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCurrentOrg } from "@/lib/org";
import { autoSolveFromRadius } from "@/lib/vrp.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Route as RouteIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/rota-otimizada")({ component: VRPPage });

function VRPPage() {
  const { orgId } = useCurrentOrg();
  const solve = useServerFn(autoSolveFromRadius);

  const [lat, setLat] = useState("-23.5505");
  const [lng, setLng] = useState("-46.6333");
  const [radius, setRadius] = useState("25");
  const [maxStops, setMaxStops] = useState("12");

  const m = useMutation({
    mutationFn: () =>
      solve({
        data: {
          organization_id: orgId!,
          depot_lat: Number(lat),
          depot_lng: Number(lng),
          radius_km: Number(radius),
          max_stops: Number(maxStops),
          avg_speed_kmh: 40,
        },
      }),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rota otimizada (VRP)"
        subtitle="Solver nearest-neighbor + 2-opt sobre coordenadas reais. Pega oportunidades em raio do depot e gera a melhor sequência."
        icon={RouteIcon}
      />

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros</CardTitle>
          <CardDescription>Defina depot e raio de busca. Stops vêm de companies/erp_customers/leads geocodificados.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div><Label>Depot lat</Label><Input value={lat} onChange={(e) => setLat(e.target.value)} /></div>
          <div><Label>Depot lng</Label><Input value={lng} onChange={(e) => setLng(e.target.value)} /></div>
          <div><Label>Raio (km)</Label><Input value={radius} onChange={(e) => setRadius(e.target.value)} /></div>
          <div><Label>Máx. paradas</Label><Input value={maxStops} onChange={(e) => setMaxStops(e.target.value)} /></div>
          <Button className="self-end" disabled={m.isPending || !orgId} onClick={() => m.mutate()}>
            <Sparkles className="h-4 w-4 mr-2" />Otimizar
          </Button>
        </CardContent>
      </Card>

      {m.data && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Paradas" value={String(m.data.ordered.length)} />
            <Stat label="Distância total" value={`${m.data.total_km.toFixed(2)} km`} />
            <Stat label="Duração estimada" value={`${m.data.est_duration_min} min`} />
            <Stat label="Candidatos" value={String((m.data as { candidates?: number }).candidates ?? "—")} />
          </div>

          <Card>
            <CardHeader><CardTitle>Sequência sugerida</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {m.data.ordered.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 text-sm">
                    <Badge variant="secondary">{i + 1}</Badge>
                    <span className="font-mono text-xs text-muted-foreground">{s.id.slice(0, 8)}</span>
                    <span>{s.label ?? "—"}</span>
                    <span className="ml-auto text-muted-foreground text-xs">
                      {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                    </span>
                  </li>
                ))}
              </ol>
              {m.data.skipped.length > 0 && (
                <p className="mt-4 text-xs text-muted-foreground">
                  {m.data.skipped.length} paradas descartadas pelos limites informados.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Trechos</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {m.data.legs.map((l, i) => (
                  <li key={i} className="flex justify-between border-b pb-1">
                    <span>{l.from} → {l.to}</span>
                    <span className="font-mono">{l.km.toFixed(2)} km</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Otimização 2-opt em {m.data.iterations} iteração(ões).
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
