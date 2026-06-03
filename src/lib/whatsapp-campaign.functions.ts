import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SEGMENTS = [
  "champions",
  "loyal",
  "potential_loyalists",
  "new_customers",
  "at_risk",
  "cant_lose",
  "hibernating",
  "lost",
] as const;

/** Pré-visualiza alvo de campanha (sem enfileirar). */
export const previewWhatsAppCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        segments: z.array(z.enum(SEGMENTS)).min(0).max(SEGMENTS.length),
        max_recency_days: z.number().int().min(0).max(3650).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = (supabase as any)
      .from("customer_360_snapshot")
      .select("erp_customer_id, display_name, primary_phone, rfm_segment, recency_days", { count: "exact" })
      .eq("organization_id", data.organization_id)
      .eq("has_whatsapp", true);
    if (data.segments.length > 0) q = q.in("rfm_segment", data.segments);
    if (data.max_recency_days != null) q = q.lte("recency_days", data.max_recency_days);
    const { data: rows, count, error } = await q.limit(20);
    if (error) throw new Error(error.message);

    // Conta total separadamente (sem limit)
    let qc = (supabase as any)
      .from("customer_360_snapshot")
      .select("erp_customer_id", { count: "exact", head: true })
      .eq("organization_id", data.organization_id)
      .eq("has_whatsapp", true);
    if (data.segments.length > 0) qc = qc.in("rfm_segment", data.segments);
    if (data.max_recency_days != null) qc = qc.lte("recency_days", data.max_recency_days);
    const { count: total } = await qc;

    return {
      total: total ?? count ?? 0,
      sample: (rows ?? []).map((r: any) => ({
        name: r.display_name,
        segment: r.rfm_segment,
        recency: r.recency_days,
      })),
    };
  });

/** Enfileira campanha WhatsApp (com agendamento opcional). */
export const scheduleWhatsAppCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        body: z.string().min(1).max(1500),
        segments: z.array(z.enum(SEGMENTS)).min(0).max(SEGMENTS.length),
        max_recency_days: z.number().int().min(0).max(3650).nullable().optional(),
        scheduled_for: z.string().datetime().nullable().optional(),
        channel_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let channelId = data.channel_id ?? null;
    if (!channelId) {
      const { data: ch } = await (supabase as any)
        .from("whatsapp_channels")
        .select("id")
        .eq("organization_id", data.organization_id)
        .eq("status", "active")
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      channelId = ch?.id ?? null;
    }
    if (!channelId) throw new Error("Nenhum canal WhatsApp ativo. Configure em Configurações → WhatsApp.");

    let q = (supabase as any)
      .from("customer_360_snapshot")
      .select("display_name, primary_phone, rfm_segment")
      .eq("organization_id", data.organization_id)
      .eq("has_whatsapp", true);
    if (data.segments.length > 0) q = q.in("rfm_segment", data.segments);
    if (data.max_recency_days != null) q = q.lte("recency_days", data.max_recency_days);
    const { data: targets, error } = await q;
    if (error) throw new Error(error.message);

    const valid = (targets ?? []).filter((t: any) => t.primary_phone && String(t.primary_phone).replace(/\D/g, "").length >= 8);
    if (valid.length === 0) return { queued: 0, skipped: targets?.length ?? 0 };

    const nextAt = data.scheduled_for ? new Date(data.scheduled_for).toISOString() : new Date().toISOString();
    const rows = valid.map((t: any) => ({
      organization_id: data.organization_id,
      channel_id: channelId,
      to_phone: String(t.primary_phone).replace(/\D/g, ""),
      body: data.body.replace(/\{name\}/g, t.display_name ?? "cliente"),
      next_attempt_at: nextAt,
    }));

    const { error: insErr } = await (supabase as any).from("whatsapp_outbox").insert(rows);
    if (insErr) throw new Error(insErr.message);
    return { queued: rows.length, skipped: (targets?.length ?? 0) - rows.length, scheduled_for: nextAt };
  });

/** Métricas agregadas dos disparos WhatsApp da organização (últimos 30 dias). */
export const getWhatsAppCampaignMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ organization_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await (supabase as any)
      .from("whatsapp_outbox")
      .select("status, created_at, sent_at, next_attempt_at")
      .eq("organization_id", data.organization_id)
      .gte("created_at", since)
      .limit(5000);
    if (error) throw new Error(error.message);

    const buckets: Record<string, number> = { pending: 0, sent: 0, failed: 0, scheduled: 0 };
    const now = Date.now();
    for (const r of rows ?? []) {
      const s = String(r.status ?? "");
      if (s === "sent") buckets.sent++;
      else if (s === "failed") buckets.failed++;
      else if (s === "pending") {
        const at = r.next_attempt_at ? new Date(r.next_attempt_at).getTime() : 0;
        if (at > now + 60_000) buckets.scheduled++;
        else buckets.pending++;
      }
    }
    const total = (rows ?? []).length;
    const successRate = buckets.sent + buckets.failed > 0
      ? buckets.sent / (buckets.sent + buckets.failed)
      : null;
    return {
      total,
      pending: buckets.pending,
      sent: buckets.sent,
      failed: buckets.failed,
      scheduled: buckets.scheduled,
      successRate,
    };
  });
