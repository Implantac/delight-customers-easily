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

function buildProfileText(c: {
  trade_name?: string | null;
  legal_name?: string | null;
  document?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  rfm_segment?: string | null;
  recency_days?: number | null;
  frequency?: number | null;
  monetary?: number | null;
  last_purchase_at?: string | null;
}): string {
  return [
    `Cliente: ${c.trade_name ?? c.legal_name ?? "—"}`,
    c.document ? `CNPJ: ${c.document}` : null,
    c.city || c.state ? `Localização: ${[c.city, c.state].filter(Boolean).join("/")}` : null,
    c.industry ? `Setor: ${c.industry}` : null,
    c.rfm_segment ? `Segmento RFM: ${c.rfm_segment}` : null,
    c.recency_days != null ? `Recência: ${c.recency_days} dias` : null,
    c.frequency != null ? `Frequência: ${c.frequency} pedidos` : null,
    c.monetary != null ? `Monetário: R$ ${Number(c.monetary).toFixed(2)}` : null,
    c.last_purchase_at ? `Última compra: ${c.last_purchase_at.slice(0, 10)}` : null,
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

    // Pega clientes com métricas; prioriza quem ainda não tem embedding
    const { data: customers, error } = await supabase
      .from("erp_customers")
      .select(
        "id, trade_name, legal_name, document, city, state, industry, last_purchase_at, erp_customer_metrics(rfm_segment, recency_days, frequency, monetary)",
      )
      .eq("organization_id", data.organization_id)
      .limit(data.limit);
    if (error) throw new Error(error.message);

    if (!customers?.length) return { indexed: 0, skipped: 0 };

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

      const m = (c as { erp_customer_metrics?: Array<Record<string, unknown>> | null })
        .erp_customer_metrics?.[0] ?? {};
      const text = buildProfileText({ ...c, ...m } as Parameters<typeof buildProfileText>[0]);

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
// 2) Propensão de recompra: encontra clientes similares aos top-recompradores
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
      .select("embedding, source_text")
      .eq("organization_id", data.organization_id)
      .eq("erp_customer_id", data.erp_customer_id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!emb) throw new Error("Cliente sem embedding — execute indexação primeiro.");

    const { data: similar, error: e2 } = await supabase.rpc("match_similar_customers", {
      _org: data.organization_id,
      _query_embedding: emb.embedding as unknown as string,
      _limit: data.top_k + 1, // +1 para descartar o próprio
    });
    if (e2) throw new Error(e2.message);

    const peers = (similar ?? []).filter(
      (s: { erp_customer_id: string }) => s.erp_customer_id !== data.erp_customer_id,
    );
    const peerIds = peers.map((p: { erp_customer_id: string }) => p.erp_customer_id);

    // Sinais comerciais dos pares
    const { data: peerMetrics } = await supabase
      .from("erp_customer_metrics")
      .select("erp_customer_id, recency_days, frequency, monetary, rfm_segment, avg_order_value")
      .eq("organization_id", data.organization_id)
      .in("erp_customer_id", peerIds.length ? peerIds : ["00000000-0000-0000-0000-000000000000"]);

    const metrics = peerMetrics ?? [];
    const avgRecency =
      metrics.reduce((s, m) => s + (m.recency_days ?? 0), 0) / Math.max(1, metrics.length);
    const avgFreq =
      metrics.reduce((s, m) => s + (m.frequency ?? 0), 0) / Math.max(1, metrics.length);
    const avgTicket =
      metrics.reduce((s, m) => s + (m.avg_order_value ?? m.monetary ?? 0), 0) /
      Math.max(1, metrics.length);

    // Confiança simples: pares ativos (recência < 90) divididos pelo total
    const active = metrics.filter((m) => (m.recency_days ?? 999) < 90).length;
    const confidence = Math.min(0.95, Math.max(0.05, active / Math.max(1, metrics.length)));

    // Janela esperada de próxima compra ≈ média de recência dos pares
    const expectedAt = new Date(Date.now() + avgRecency * 86400000).toISOString();

    return {
      confidence: Math.round(confidence * 100) / 100,
      expected_purchase_at: expectedAt,
      expected_value: Math.round(avgTicket * 100) / 100,
      peers: peers.slice(0, data.top_k),
      signals: {
        peer_avg_recency_days: Math.round(avgRecency),
        peer_avg_frequency: Math.round(avgFreq * 100) / 100,
        peer_avg_ticket: Math.round(avgTicket * 100) / 100,
        active_peers: active,
      },
    };
  });

// ---------------------------------------------------------------------------
// 3) Propensão de churn: cliente fica próximo de quem já churnou
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
      .select("erp_customer_id, recency_days, rfm_segment, trend")
      .eq("organization_id", data.organization_id)
      .in("erp_customer_id", peerIds.length ? peerIds : ["00000000-0000-0000-0000-000000000000"]);

    const metrics = peerMetrics ?? [];
    const churned = metrics.filter(
      (m) =>
        (m.recency_days ?? 0) > 180 ||
        m.rfm_segment === "lost" ||
        m.rfm_segment === "hibernating" ||
        m.trend === "declining",
    ).length;

    const churnRisk = Math.min(0.99, churned / Math.max(1, metrics.length));

    return {
      churn_risk: Math.round(churnRisk * 100) / 100,
      similar_churned: churned,
      similar_total: metrics.length,
      severity:
        churnRisk >= 0.66 ? "high" : churnRisk >= 0.33 ? "medium" : "low",
      peers: peers.slice(0, data.top_k),
    };
  });

// ---------------------------------------------------------------------------
// 4) Status / cobertura de embeddings na organização
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
      indexed,
      coverage_pct: t > 0 ? Math.round((i / t) * 100) : 0,
    };
  });
