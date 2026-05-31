import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { solveVRP, type Stop } from "./vrp";

const StopSchema = z.object({
  id: z.string().min(1).max(128),
  label: z.string().max(255).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  service_min: z.number().min(0).max(480).optional(),
  priority: z.number().min(0).max(10).optional(),
});

const InputSchema = z.object({
  organization_id: z.string().uuid(),
  depot: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    label: z.string().max(255).optional(),
  }),
  stops: z.array(StopSchema).min(1).max(200),
  max_stops: z.number().int().min(1).max(50).optional(),
  max_km: z.number().min(1).max(2000).optional(),
  avg_speed_kmh: z.number().min(5).max(120).optional(),
});

export const solveCommercialRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => InputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isMember } = await supabase.rpc("is_org_member", {
      _org: data.organization_id,
      _user: userId,
    });
    if (!isMember) throw new Error("Acesso negado à organização");

    const out = solveVRP({
      depot: data.depot,
      stops: data.stops as Stop[],
      max_stops: data.max_stops,
      max_km: data.max_km,
      avg_speed_kmh: data.avg_speed_kmh,
    });
    return out;
  });

/**
 * Variante: pega oportunidades em raio + resolve VRP automaticamente.
 * Usa find_opportunities_in_radius (já existente).
 */
const AutoInput = z.object({
  organization_id: z.string().uuid(),
  depot_lat: z.number().min(-90).max(90),
  depot_lng: z.number().min(-180).max(180),
  radius_km: z.number().min(1).max(500).default(25),
  max_stops: z.number().int().min(1).max(30).default(12),
  avg_speed_kmh: z.number().min(5).max(120).default(40),
});

export const autoSolveFromRadius = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => AutoInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: opps, error } = await supabase.rpc("find_opportunities_in_radius", {
      _org: data.organization_id,
      _lat: data.depot_lat,
      _lng: data.depot_lng,
      _radius_km: data.radius_km,
      _subject_types: ["company", "erp_customer", "lead"],
      _limit: 80,
    });
    if (error) throw new Error(error.message);

    const stops: Stop[] = (opps ?? [])
      .filter((o: { latitude: number | null; longitude: number | null }) => o.latitude != null && o.longitude != null)
      .map((o: { subject_id: string; subject_type: string; latitude: number; longitude: number; city: string | null }, i: number) => ({
        id: o.subject_id,
        label: `${o.subject_type}:${o.city ?? ""}`,
        lat: o.latitude,
        lng: o.longitude,
        priority: 1 + (10 - Math.min(10, i / 8)),
      }));

    if (!stops.length) {
      return {
        ordered: [],
        skipped: [],
        total_km: 0,
        est_duration_min: 0,
        legs: [],
        iterations: 0,
        candidates: 0,
      };
    }

    const out = solveVRP({
      depot: { lat: data.depot_lat, lng: data.depot_lng, label: "depot" },
      stops,
      max_stops: data.max_stops,
      avg_speed_kmh: data.avg_speed_kmh,
    });
    return { ...out, candidates: stops.length };
  });
