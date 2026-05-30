import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ===========================================================================
// Marketing & Influencer Intelligence
// Leads vindos de WhatsApp, IG, FB, TikTok, LinkedIn, Google Business, LP,
// influenciadores. Tudo num inbox unificado, com conversão para Contato/Deal.
// ===========================================================================

export type MarketingLead = {
  id: string;
  channel: string;
  source: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  city: string | null;
  state: string | null;
  status: "new" | "qualified" | "converted" | "discarded";
  converted_contact_id: string | null;
  converted_deal_id: string | null;
  created_at: string;
};

export const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "google_business", label: "Google Business" },
  { id: "landing_page", label: "Landing Page" },
  { id: "influencer", label: "Influenciador" },
] as const;

const orgInput = z.object({ organization_id: z.string().uuid() });

export const getMarketingOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [leadsRes, recentRes] = await Promise.all([
      supabase
        .from("marketing_leads")
        .select("id,channel,status,source,created_at,converted_deal_id")
        .eq("organization_id", org)
        .gte("created_at", since)
        .limit(5000),
      supabase
        .from("marketing_leads")
        .select("*")
        .eq("organization_id", org)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const all = leadsRes.data ?? [];
    const byChannel = new Map<string, { channel: string; total: number; converted: number }>();
    for (const c of CHANNELS) byChannel.set(c.id, { channel: c.id, total: 0, converted: 0 });
    for (const l of all) {
      const cur = byChannel.get(l.channel) ?? { channel: l.channel, total: 0, converted: 0 };
      cur.total += 1;
      if (l.status === "converted") cur.converted += 1;
      byChannel.set(l.channel, cur);
    }

    return {
      summary: {
        total_30d: all.length,
        new_count: all.filter((l) => l.status === "new").length,
        qualified_count: all.filter((l) => l.status === "qualified").length,
        converted_count: all.filter((l) => l.status === "converted").length,
      },
      byChannel: [...byChannel.values()].map((c) => ({
        ...c,
        conversion_pct: c.total > 0 ? Math.round((c.converted / c.total) * 100) : 0,
      })),
      recent: (recentRes.data ?? []) as MarketingLead[],
    };
  });

export const updateLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "qualified", "converted", "discarded"]),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("marketing_leads")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===========================================================================
// Influencers — cadastro + ROI vs outros canais
// ===========================================================================

export type InfluencerRow = {
  id: string;
  name: string;
  handle: string | null;
  platform: string | null;
  slug: string;
  coupon_code: string | null;
  commission_pct: number;
  is_active: boolean;
  leads_30d: number;
  converted_30d: number;
  headline: string | null;
  bio: string | null;
  hero_image_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  lp_enabled: boolean;
};


export const listInfluencers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [infRes, leadRes] = await Promise.all([
      supabase
        .from("influencers")
        .select("*")
        .eq("organization_id", org)
        .order("created_at", { ascending: false }),
      supabase
        .from("marketing_leads")
        .select("source,status,created_at")
        .eq("organization_id", org)
        .eq("channel", "influencer")
        .gte("created_at", since),
    ]);

    const leads = leadRes.data ?? [];
    const bySlug = new Map<string, { leads: number; converted: number }>();
    for (const l of leads) {
      const k = (l.source ?? "").toLowerCase();
      const cur = bySlug.get(k) ?? { leads: 0, converted: 0 };
      cur.leads += 1;
      if (l.status === "converted") cur.converted += 1;
      bySlug.set(k, cur);
    }

    const rows: InfluencerRow[] = (infRes.data ?? []).map((i: any) => {
      const s = bySlug.get(i.slug.toLowerCase()) ?? { leads: 0, converted: 0 };
      return {
        id: i.id,
        name: i.name,
        handle: i.handle,
        platform: i.platform,
        slug: i.slug,
        coupon_code: i.coupon_code,
        commission_pct: Number(i.commission_pct ?? 0),
        is_active: i.is_active,
        leads_30d: s.leads,
        converted_30d: s.converted,
        headline: i.headline ?? null,
        bio: i.bio ?? null,
        hero_image_url: i.hero_image_url ?? null,
        cta_text: i.cta_text ?? null,
        cta_url: i.cta_url ?? null,
        lp_enabled: !!i.lp_enabled,
      };
    });

    return { rows };
  });


export const upsertInfluencer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      id: z.string().uuid().optional(),
      organization_id: z.string().uuid(),
      name: z.string().min(1).max(200),
      handle: z.string().max(120).optional().nullable(),
      platform: z.string().max(50).optional().nullable(),
      slug: z.string().min(1).max(80),
      coupon_code: z.string().max(60).optional().nullable(),
      commission_pct: z.number().min(0).max(100).default(0),
      is_active: z.boolean().default(true),
      headline: z.string().max(200).optional().nullable(),
      bio: z.string().max(2000).optional().nullable(),
      hero_image_url: z.string().max(2000).optional().nullable(),
      cta_text: z.string().max(80).optional().nullable(),
      cta_url: z.string().max(2000).optional().nullable(),
      lp_enabled: z.boolean().default(false),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const slug = data.slug.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) throw new Error("Slug inválido");
    const payload = {
      organization_id: data.organization_id,
      name: data.name,
      handle: data.handle ?? null,
      platform: data.platform ?? null,
      slug,
      coupon_code: data.coupon_code ?? null,
      commission_pct: data.commission_pct,
      is_active: data.is_active,
      headline: data.headline ?? null,
      bio: data.bio ?? null,
      hero_image_url: data.hero_image_url ?? null,
      cta_text: data.cta_text ?? null,
      cta_url: data.cta_url ?? null,
      lp_enabled: data.lp_enabled,
    };
    if (data.id) {
      const { error } = await context.supabase.from("influencers").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: r, error } = await context.supabase
      .from("influencers").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: r.id };
  });


export const deleteInfluencer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("influencers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
