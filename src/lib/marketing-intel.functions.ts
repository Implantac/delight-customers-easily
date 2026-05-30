import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// =============================================================================
// Onda 6 — Marketing & Influencer Intelligence
// Une marketing ao comercial: campanhas → leads → contatos → deals → receita.
// Mede ROI por canal, por campanha e por influenciador.
// =============================================================================

const Input = z.object({
  organization_id: z.string().uuid(),
  window_days: z.number().int().min(7).max(365).default(90),
});

export type ChannelRow = {
  channel: string;
  leads: number;
  converted: number;
  conversion_rate: number;
  won_revenue: number;
  open_pipeline: number;
};

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  sent: number;
  opened: number;
  clicked: number;
  open_rate: number;
  click_rate: number;
  sent_at: string | null;
};

export type InfluencerRow = {
  id: string;
  name: string;
  handle: string | null;
  platform: string | null;
  visits: number;
  conversions: number;
  revenue: number;
  commission: number;
  cvr: number; // visits → conversions %
};

export const getMarketingIntel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;
    const since = new Date(Date.now() - data.window_days * 86_400_000).toISOString();

    const [leadsRes, dealsRes, campRes, infRes, visitsRes, convRes] = await Promise.all([
      supabase.from("marketing_leads")
        .select("id, channel, status, converted_deal_id, created_at")
        .eq("organization_id", org).gte("created_at", since).limit(10000),
      supabase.from("deals")
        .select("id, stage, value, created_at")
        .eq("organization_id", org).gte("created_at", since).limit(10000),
      supabase.from("email_campaigns")
        .select("id, name, status, total_sent, total_opened, total_clicked, sent_at")
        .eq("organization_id", org)
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(50),
      supabase.from("influencers")
        .select("id, name, handle, platform, is_active")
        .eq("organization_id", org).limit(500),
      supabase.from("influencer_visits")
        .select("influencer_id, created_at")
        .eq("organization_id", org).gte("created_at", since).limit(20000),
      supabase.from("influencer_conversions")
        .select("influencer_id, value, commission, status")
        .eq("organization_id", org).gte("created_at", since).limit(10000),
    ]);

    const leads = (leadsRes.data ?? []) as any[];
    const deals = (dealsRes.data ?? []) as any[];

    // ---------------- Por canal ----------------
    const channelMap = new Map<string, ChannelRow>();
    const dealById = new Map<string, any>(deals.map((d) => [d.id, d]));
    for (const l of leads) {
      const ch = (l.channel || "outros") as string;
      const cur = channelMap.get(ch) ?? {
        channel: ch, leads: 0, converted: 0, conversion_rate: 0,
        won_revenue: 0, open_pipeline: 0,
      };
      cur.leads += 1;
      if (l.converted_deal_id) {
        cur.converted += 1;
        const d = dealById.get(l.converted_deal_id);
        if (d) {
          const v = Number(d.value || 0);
          if (d.stage === "won") cur.won_revenue += v;
          else if (d.stage !== "lost") cur.open_pipeline += v;
        }
      }
      channelMap.set(ch, cur);
    }
    const channels = [...channelMap.values()]
      .map((c) => ({ ...c, conversion_rate: c.leads ? (c.converted / c.leads) * 100 : 0 }))
      .sort((a, b) => b.won_revenue - a.won_revenue || b.leads - a.leads);

    // ---------------- Campanhas ----------------
    const campaigns: CampaignRow[] = ((campRes.data ?? []) as any[]).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      sent: c.total_sent || 0,
      opened: c.total_opened || 0,
      clicked: c.total_clicked || 0,
      open_rate: c.total_sent ? (c.total_opened / c.total_sent) * 100 : 0,
      click_rate: c.total_sent ? (c.total_clicked / c.total_sent) * 100 : 0,
      sent_at: c.sent_at,
    }));

    // ---------------- Influencers ----------------
    const visitByInf = new Map<string, number>();
    for (const v of (visitsRes.data ?? []) as any[]) {
      visitByInf.set(v.influencer_id, (visitByInf.get(v.influencer_id) ?? 0) + 1);
    }
    type IAgg = { count: number; value: number; commission: number };
    const convByInf = new Map<string, IAgg>();
    for (const c of (convRes.data ?? []) as any[]) {
      const cur = convByInf.get(c.influencer_id) ?? { count: 0, value: 0, commission: 0 };
      cur.count += 1;
      cur.value += Number(c.value || 0);
      cur.commission += Number(c.commission || 0);
      convByInf.set(c.influencer_id, cur);
    }
    const influencers: InfluencerRow[] = ((infRes.data ?? []) as any[]).map((i) => {
      const visits = visitByInf.get(i.id) ?? 0;
      const conv = convByInf.get(i.id) ?? { count: 0, value: 0, commission: 0 };
      return {
        id: i.id,
        name: i.name,
        handle: i.handle ?? null,
        platform: i.platform ?? null,
        visits,
        conversions: conv.count,
        revenue: conv.value,
        commission: conv.commission,
        cvr: visits ? (conv.count / visits) * 100 : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue || b.visits - a.visits);

    // ---------------- Summary ----------------
    const summary = {
      total_leads: leads.length,
      total_converted: leads.filter((l) => l.converted_deal_id).length,
      total_won_revenue: channels.reduce((s, c) => s + c.won_revenue, 0),
      total_pipeline: channels.reduce((s, c) => s + c.open_pipeline, 0),
      total_visits: [...visitByInf.values()].reduce((a, b) => a + b, 0),
      total_inf_revenue: influencers.reduce((s, i) => s + i.revenue, 0),
      total_commission: influencers.reduce((s, i) => s + i.commission, 0),
      window_days: data.window_days,
    };

    return { summary, channels, campaigns, influencers };
  });
