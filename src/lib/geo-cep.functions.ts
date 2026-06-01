/**
 * Geocodificação automática por CEP brasileiro.
 * Usa ViaCEP (endereço) + Nominatim/OpenStreetMap (lat/lng), 100% gratuito.
 *
 * Sem chaves obrigatórias. Para volumes altos, recomenda-se Google Geocoding.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ViaCep = {
  cep?: string; logradouro?: string; complemento?: string;
  bairro?: string; localidade?: string; uf?: string; ibge?: string;
  erro?: boolean;
};

async function viaCep(cep: string): Promise<ViaCep | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  if (!res.ok) return null;
  const j = (await res.json()) as ViaCep;
  if (j?.erro) return null;
  return j;
}

async function nominatim(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "lovable-crm/1.0 (geocoding)" },
  });
  if (!res.ok) return null;
  const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!arr?.length) return null;
  return { lat: Number(arr[0].lat), lng: Number(arr[0].lon) };
}

export const geocodeByCep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      cep: z.string().min(8).max(10),
      number: z.string().max(32).optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const v = await viaCep(data.cep);
    if (!v) return { ok: false as const, error: "CEP não encontrado" };
    const q = [v.logradouro, data.number, v.bairro, v.localidade, v.uf, "Brasil"]
      .filter(Boolean).join(", ");
    const coords = q ? await nominatim(q) : null;
    return {
      ok: true as const,
      address: {
        cep: v.cep ?? data.cep,
        street: v.logradouro ?? null,
        neighborhood: v.bairro ?? null,
        city: v.localidade ?? null,
        state: v.uf ?? null,
        ibge_code: v.ibge ?? null,
      },
      coords,
      source: "viacep+nominatim",
    };
  });
