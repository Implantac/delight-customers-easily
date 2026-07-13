/**
 * Mapa interativo com pins de clientes/prospects e polilinha de rota opcional.
 * Usa Google Maps JS carregado via `loading=async` + callback global.
 *
 * Pontos são categorizados em três tipos, com cor distinta:
 *  - "customer"  → cliente da carteira        (azul)
 *  - "prospect"  → sugerido pela IA           (âmbar)
 *  - "stop"      → parada da rota do dia      (verde, numerada)
 *
 * Uso mínimo:
 *   <ClientsMap points={[{id, name, lat, lng, kind:"customer"}]} />
 *
 * Uso com rota (desenha polilinha na ordem das paradas):
 *   <ClientsMap points={...} route={[{lat,lng}, {lat,lng}]} />
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { MapPin, Loader2 } from "lucide-react";

export type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "customer" | "prospect" | "stop";
  subtitle?: string;
};

type Props = {
  points: MapPoint[];
  route?: Array<{ lat: number; lng: number }>;
  height?: number;
  className?: string;
};

const COLORS: Record<MapPoint["kind"], string> = {
  customer: "#3b82f6", // azul (cliente ativo)
  prospect: "#f59e0b", // âmbar (potencial/IA)
  stop:     "#10b981", // verde (parada do dia)
};

const SCRIPT_ID = "google-maps-js-sdk";
const CALLBACK = "__lovableInitGoogleMaps__";

// Promise única, memoizada em window, para não recarregar o script em navegações.
declare global {
  interface Window {
    google?: typeof google;
    __lovableInitGoogleMaps__?: () => void;
    __lovableGoogleMapsPromise__?: Promise<typeof google>;
  }
}

function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (window.__lovableGoogleMapsPromise__) return window.__lovableGoogleMapsPromise__;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  if (!key) return Promise.reject(new Error("Google Maps browser key não configurada"));

  window.__lovableGoogleMapsPromise__ = new Promise((resolve, reject) => {
    window[CALLBACK] = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps callback disparou sem SDK"));
    };
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.defer = true;
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&loading=async&callback=${CALLBACK}` +
      (channel ? `&channel=${encodeURIComponent(channel)}` : "");
    s.onerror = () => reject(new Error("Falha ao carregar Google Maps JS"));
    document.head.appendChild(s);
  });

  return window.__lovableGoogleMapsPromise__;
}

export function ClientsMap({ points, route, height = 420, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filtra pontos válidos uma vez para computar center/bounds e evitar re-render.
  const validPoints = useMemo(
    () => points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [points],
  );

  // Inicializa o mapa (uma vez por montagem do componente).
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !ref.current) return;
        // Centro default: Brasil. Vai ser sobrescrito pelo fitBounds abaixo.
        mapRef.current = new g.maps.Map(ref.current, {
          center: { lat: -14.235, lng: -51.925 },
          zoom: 4,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            { featureType: "poi.business", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Redesenha marcadores/polilinha quando dados mudam.
  useEffect(() => {
    const map = mapRef.current;
    const g = window.google;
    if (!map || !g?.maps) return;

    // Limpa marcadores antigos
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylineRef.current?.setMap(null);
    polylineRef.current = null;

    if (validPoints.length === 0) return;

    const bounds = new g.maps.LatLngBounds();
    const info = new g.maps.InfoWindow();
    let stopIndex = 0;
    validPoints.forEach((p) => {
      const isStop = p.kind === "stop";
      if (isStop) stopIndex += 1;
      const marker = new g.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: p.name,
        label: isStop
          ? { text: String(stopIndex), color: "#fff", fontSize: "11px", fontWeight: "600" }
          : undefined,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: isStop ? 12 : 8,
          fillColor: COLORS[p.kind],
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        const kindLabel =
          p.kind === "customer" ? "Cliente"
          : p.kind === "prospect" ? "Prospect (IA)"
          : `Parada #${stopIndex}`;
        info.setContent(
          `<div style="font: 12px system-ui; max-width:220px">
             <div style="font-weight:600;margin-bottom:2px">${escapeHtml(p.name)}</div>
             <div style="color:#64748b">${kindLabel}</div>
             ${p.subtitle ? `<div style="margin-top:4px;color:#334155">${escapeHtml(p.subtitle)}</div>` : ""}
           </div>`,
        );
        info.open({ anchor: marker, map });
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: p.lat, lng: p.lng });
    });

    // Polilinha da rota (opcional): conecta paradas na ordem informada.
    if (route && route.length >= 2) {
      polylineRef.current = new g.maps.Polyline({
        path: route,
        map,
        strokeColor: COLORS.stop,
        strokeOpacity: 0.85,
        strokeWeight: 4,
      });
      route.forEach((p) => bounds.extend(p));
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 60);
      // Evita zoom exagerado quando só há 1 ponto
      const listener = g.maps.event.addListenerOnce(map, "bounds_changed", () => {
        if ((map.getZoom() ?? 0) > 15) map.setZoom(15);
      });
      return () => g.maps.event.removeListener(listener);
    }
  }, [validPoints, route]);

  const empty = validPoints.length === 0;

  return (
    <Card className={"relative overflow-hidden " + (className ?? "")} style={{ height }}>
      <div ref={ref} className="absolute inset-0" aria-label="Mapa de clientes" />

      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-muted/40 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando mapa…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-background/95 p-6 text-center">
          <div>
            <MapPin className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <div className="text-sm font-medium">Não foi possível carregar o mapa</div>
            <div className="mt-1 text-xs text-muted-foreground">{error}</div>
          </div>
        </div>
      )}
      {!loading && !error && empty && (
        <div className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full border bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow">
          Nenhum ponto com coordenadas para exibir
        </div>
      )}

      {/* Legenda flutuante */}
      {!loading && !error && !empty && (
        <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1 rounded-lg border bg-background/90 px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur">
          <LegendDot color={COLORS.customer} label="Cliente" />
          <LegendDot color={COLORS.prospect} label="Prospect (IA)" />
          {route && route.length >= 2 && <LegendDot color={COLORS.stop} label="Parada da rota" />}
        </div>
      )}
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full border border-white" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}
