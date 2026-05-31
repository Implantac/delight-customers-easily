import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// =============================================================================
// Propensão de recompra / churn via embeddings (pgvector).
// 1) Constrói um "perfil comercial" textual de cada cliente
// 2) Gera embedding via Lovable AI Gateway
// 3) Armazena em customer_embeddings (vector(1536))
// 4) Predições: usa similaridade + sinais de RFM/última compra
// =============================================================================

const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims
const GATEWAY = "https://ai.gateway.lovable.dev/v1/embeddings";

async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente no servidor");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 4000) }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embedding falhou (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data[0].embedding;
}

type ProfileInput = {
  trade_name?: string | null;
  legal_name?: string | null;
  document?: string | null;
  city?: string | null;
  state?: string | null;
  segment?: string | null;
  rfm_segment?: string | null;
  recency_days?: number | null;
  frequency_365d?: number | null;
  monetary_365d?: number | null;
  avg_ticket?: number | null;
  last_order_at?: string | null;
};

function buildProfileText(c: ProfileInput): string {
  return [
    `Cliente: ${c.trade_name ?? c.legal_name ?? "—"}`,
    c.document ? `CNPJ: ${c.document}` : null,
    c.city || c.state ? `Localização: ${[c.city, c.state].filter(Boolean).join("/")}` : null,
    c.segment ? `Segmento comercial: ${c.segment}` : null,
    c.rfm_segment ? `Segmento RFM: ${c.rfm_segment}` : null,
    c.recency_days != null ? `Recência: ${c.recency_days} dias` : null,
    c.frequency_365d != null ? `Frequência 365d: ${c.frequency_365d} pedidos` : null,
    c.monetary_365d != null ? `Monetário 365d: R$ ${Number(c.monetary_365d).toFixed(2)}` : null,
    c.avg_ticket != null ? `Ticket médio: R$ ${Number(c.avg_ticket).toFixed(2)}` : null,
    c.last_order_at ? `Última compra: ${c.last_order_at.slice(0, 10)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// 1) Indexa um lote de clientes (gera/atualiza embeddings)
// ---------------------------------------------------------------------------
export const indexCustomerEmbeddings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(25),
        force: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: canManage } = await supabase.rpc("has_org_role", {
      _org: data.organization_id,
      _user: userId,
      _roles: ["owner", "admin"],
    });
    if (!canManage) throw new Error("Apenas owner/admin pode indexar embeddings");

    const { data: customers, error } = await supabase
      .from("erp_customers")
      .select("id, trade_name, legal_name, document, city, state, segment")
      .eq("organization_id", data.organization_id)
      .limit(data.limit);
    if (error) throw new Error(error.message);
    if (!customers?.length) return { indexed: 0, skipped: 0 };

    const ids = customers.map((c) => c.id);
    const { data: metrics } = await supabase
      .from("erp_customer_metrics")
      .select(
        "erp_customer_id, recency_days, frequency_365d, monetary_365d, avg_ticket, rfm_segment, last_order_at",
      )
      .eq("organization_id", data.organization_id)
      .in("erp_customer_id", ids);
    const metricsById = new Map(
      (metrics ?? []).map((m) => [m.erp_customer_id, m] as const),
    );

    let indexed = 0;
    let skipped = 0;
    for (const c of customers) {
      if (!data.force) {
        const { data: existing } = await supabase
          .from("customer_embeddings")
          .select("id")
          .eq("organization_id", data.organization_id)
          .eq("erp_customer_id", c.id)
          .maybeSingle();
        if (existing) {
          skipped++;
          continue;
        }
      }

      const m = metricsById.get(c.id) ?? {};
      const text = buildProfileText({ ...c, ...m } as ProfileInput);

      try {
        const vector = await embed(text);
        await supabase.from("customer_embeddings").upsert(
          {
            organization_id: data.organization_id,
            erp_customer_id: c.id,
            embedding: vector as unknown as string,
            source_text: text,
            model: EMBED_MODEL,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,erp_customer_id" },
        );
        indexed++;
      } catch (e) {
        skipped++;
        console.error("[propensity] embed fail", c.id, (e as Error).message);
      }
    }

    return { indexed, skipped };
  });

// ---------------------------------------------------------------------------
// 2) Propensão de recompra
// ---------------------------------------------------------------------------
export const predictRepurchasePropensity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        erp_customer_id: z.string().uuid(),
        top_k: z.number().int().min(3).max(20).default(8),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: emb, error: e1 } = await supabase
      .from("customer_embeddings")
      .select("embedding")
      .eq("organization_id", data.organization_id)
      .eq("erp_customer_id", data.erp_customer_id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!emb) throw new Error("Cliente sem embedding — execute indexação primeiro.");

    const { data: similar, error: e2 } = await supabase.rpc("match_similar_customers", {
      _org: data.organization_id,
      _query_embedding: emb.embedding as unknown as string,
      _limit: data.top_k + 1,
    });
    if (e2) throw new Error(e2.message);

    const peers = (similar ?? []).filter(
      (s: { erp_customer_id: string }) => s.erp_customer_id !== data.erp_customer_id,
    );
    const peerIds = peers.map((p: { erp_customer_id: string }) => p.erp_customer_id);

    const { data: peerMetrics } = await supabase
      .from("erp_customer_metrics")
      .select(
        "erp_customer_id, recency_days, frequency_365d, monetary_365d, avg_ticket, rfm_segment",
      )
      .eq("organization_id", data.organization_id)
      .in("erp_customer_id", peerIds.length ? peerIds : ["00000000-0000-0000-0000-000000000000"]);

    const metrics = peerMetrics ?? [];
    const avgRecency =
      metrics.reduce((s, m) => s + (m.recency_days ?? 0), 0) / Math.max(1, metrics.length);
    const avgFreq =
      metrics.reduce((s, m) => s + (m.frequency_365d ?? 0), 0) / Math.max(1, metrics.length);
    const avgTicket =
      metrics.reduce((s, m) => s + Number(m.avg_ticket ?? 0), 0) / Math.max(1, metrics.length);

    const active = metrics.filter((m) => (m.recency_days ?? 999) < 90).length;
    const confidence = Math.min(0.95, Math.max(0.05, active / Math.max(1, metrics.length)));

    const expectedAt = new Date(Date.now() + avgRecency * 86400000).toISOString();

    return {
      confidence: Math.round(confidence * 100) / 100,
      expected_purchase_at: expectedAt,
      expected_value: Math.round(avgTicket * 100) / 100,
      peers: peers.slice(0, data.top_k),
      signals: {
        peer_avg_recency_days: Math.round(avgRecency),
        peer_avg_frequency_365d: Math.round(avgFreq * 100) / 100,
        peer_avg_ticket: Math.round(avgTicket * 100) / 100,
        active_peers: active,
      },
    };
  });

// ---------------------------------------------------------------------------
// 3) Propensão de churn
// ---------------------------------------------------------------------------
export const predictChurnPropensity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        erp_customer_id: z.string().uuid(),
        top_k: z.number().int().min(3).max(20).default(8),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: emb } = await supabase
      .from("customer_embeddings")
      .select("embedding")
      .eq("organization_id", data.organization_id)
      .eq("erp_customer_id", data.erp_customer_id)
      .maybeSingle();
    if (!emb) throw new Error("Cliente sem embedding — execute indexação primeiro.");

    const { data: similar } = await supabase.rpc("match_similar_customers", {
      _org: data.organization_id,
      _query_embedding: emb.embedding as unknown as string,
      _limit: data.top_k + 1,
    });

    const peers = (similar ?? []).filter(
      (s: { erp_customer_id: string }) => s.erp_customer_id !== data.erp_customer_id,
    );
    const peerIds = peers.map((p: { erp_customer_id: string }) => p.erp_customer_id);

    const { data: peerMetrics } = await supabase
      .from("erp_customer_metrics")
      .select("erp_customer_id, recency_days, rfm_segment, trend_90d")
      .eq("organization_id", data.organization_id)
      .in("erp_customer_id", peerIds.length ? peerIds : ["00000000-0000-0000-0000-000000000000"]);

    const metrics = peerMetrics ?? [];
    const churned = metrics.filter(
      (m) =>
        (m.recency_days ?? 0) > 180 ||
        m.rfm_segment === "lost" ||
        m.rfm_segment === "hibernating" ||
        Number(m.trend_90d ?? 0) < -0.2,
    ).length;

    const churnRisk = Math.min(0.99, churned / Math.max(1, metrics.length));

    return {
      churn_risk: Math.round(churnRisk * 100) / 100,
      similar_churned: churned,
      similar_total: metrics.length,
      severity: churnRisk >= 0.66 ? "high" : churnRisk >= 0.33 ? "medium" : "low",
      peers: peers.slice(0, data.top_k),
    };
  });

// ---------------------------------------------------------------------------
// 4) Cobertura
// ---------------------------------------------------------------------------
export const getEmbeddingCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ count: total }, { count: indexed }] = await Promise.all([
      supabase
        .from("erp_customers")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", data.organization_id),
      supabase
        .from("customer_embeddings")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", data.organization_id),
    ]);
    const t = total ?? 0;
    const i = indexed ?? 0;
    return {
      total_customers: t,
      indexed: i,
      coverage_pct: t > 0 ? Math.round((i / t) * 100) : 0,
    };
  });
