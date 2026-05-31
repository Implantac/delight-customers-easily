// VRP solver leve para roteirização comercial.
// Nearest-neighbor + 2-opt em coordenadas lat/lng (Haversine).
// Sem dependências externas — roda em Worker.

export type Stop = {
  id: string;
  label?: string;
  lat: number;
  lng: number;
  // peso opcional: tempo de visita (min), prioridade etc.
  service_min?: number;
  priority?: number;
};

export type SolverInput = {
  depot: { lat: number; lng: number; label?: string };
  stops: Stop[];
  max_stops?: number;          // limite por rota
  max_km?: number;             // distância máxima total
  avg_speed_kmh?: number;      // p/ estimar duração (default 40)
};

export type SolverOutput = {
  ordered: Stop[];
  skipped: Stop[];
  total_km: number;
  est_duration_min: number;
  legs: Array<{ from: string; to: string; km: number }>;
  iterations: number;
};

const R = 6371; // raio da Terra em km
function hav(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function tourKm(depot: { lat: number; lng: number }, order: Stop[]): number {
  if (!order.length) return 0;
  let km = hav(depot, order[0]);
  for (let i = 1; i < order.length; i++) km += hav(order[i - 1], order[i]);
  km += hav(order[order.length - 1], depot);
  return km;
}

function nearestNeighbor(depot: { lat: number; lng: number }, stops: Stop[]): Stop[] {
  const pool = [...stops];
  const out: Stop[] = [];
  let cur: { lat: number; lng: number } = depot;
  while (pool.length) {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const d = hav(cur, pool[i]);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    const next = pool.splice(bestI, 1)[0];
    out.push(next);
    cur = next;
  }
  return out;
}

function twoOpt(depot: { lat: number; lng: number }, order: Stop[], maxIter = 200): { order: Stop[]; iter: number } {
  let best = order;
  let bestKm = tourKm(depot, best);
  let improved = true;
  let iter = 0;
  while (improved && iter < maxIter) {
    improved = false;
    iter++;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const newOrder = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        const km = tourKm(depot, newOrder);
        if (km + 1e-6 < bestKm) {
          best = newOrder;
          bestKm = km;
          improved = true;
        }
      }
    }
  }
  return { order: best, iter };
}

export function solveVRP(input: SolverInput): SolverOutput {
  const speed = input.avg_speed_kmh ?? 40;
  const stops = (input.stops ?? []).filter(
    (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng),
  );

  // Ordena por prioridade desc (alta primeiro) — não respeitada por NN, mas
  // útil quando aplicarmos max_stops.
  stops.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  let ordered = nearestNeighbor(input.depot, stops);
  const opt = twoOpt(input.depot, ordered, 200);
  ordered = opt.order;

  // Aplica limites (max_stops / max_km)
  const skipped: Stop[] = [];
  if (input.max_stops && ordered.length > input.max_stops) {
    skipped.push(...ordered.slice(input.max_stops));
    ordered = ordered.slice(0, input.max_stops);
  }
  if (input.max_km) {
    while (ordered.length && tourKm(input.depot, ordered) > input.max_km) {
      skipped.push(ordered.pop()!);
    }
  }

  const legs: SolverOutput["legs"] = [];
  if (ordered.length) {
    legs.push({
      from: input.depot.label ?? "depot",
      to: ordered[0].label ?? ordered[0].id,
      km: hav(input.depot, ordered[0]),
    });
    for (let i = 1; i < ordered.length; i++) {
      legs.push({
        from: ordered[i - 1].label ?? ordered[i - 1].id,
        to: ordered[i].label ?? ordered[i].id,
        km: hav(ordered[i - 1], ordered[i]),
      });
    }
    legs.push({
      from: ordered[ordered.length - 1].label ?? ordered[ordered.length - 1].id,
      to: input.depot.label ?? "depot",
      km: hav(ordered[ordered.length - 1], input.depot),
    });
  }

  const total_km = legs.reduce((s, l) => s + l.km, 0);
  const service = ordered.reduce((s, st) => s + (st.service_min ?? 15), 0);
  const est_duration_min = Math.round((total_km / speed) * 60 + service);

  return {
    ordered,
    skipped,
    total_km: Math.round(total_km * 100) / 100,
    est_duration_min,
    legs,
    iterations: opt.iter,
  };
}
