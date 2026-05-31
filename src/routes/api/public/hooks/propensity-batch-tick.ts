import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { requireCronApiKey } from '@/lib/cron-auth.server';

/**
 * #10 — Job em lote para IA comercial.
 * - Indexa embeddings dos próximos N clientes ainda sem vetor
 * - (futuro) Pode disparar predições em lote
 *
 * Acionado por pg_cron a cada hora.
 * Funciona por org para respeitar o esquema de organizações.
 */

const EMBED_MODEL = "openai/text-embedding-3-small";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/embeddings";
const MAX_PER_ORG = 20;

async function embed(text: string): Promise<number[] | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const r = await fetch(GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 4000) }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data: Array<{ embedding: number[] }> };
    return j.data[0].embedding;
  } catch {
    return null;
  }
}

export const Route = createFileRoute('/api/public/hooks/propensity-batch-tick')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronApiKey(request);
        if (unauth) return unauth;

        // Lista organizações ativas
        const { data: orgs } = await supabaseAdmin
          .from('organizations')
          .select('id')
          .in('org_type', ['tenant', 'company', 'branch']);

        let totalIndexed = 0;
        let totalSkipped = 0;
        const perOrg: Array<{ org: string; indexed: number; skipped: number }> = [];

        for (const o of orgs ?? []) {
          // Clientes da org
          const { data: customers } = await supabaseAdmin
            .from('erp_customers')
            .select('id, trade_name, legal_name, document, city, state, segment')
            .eq('organization_id', o.id)
            .limit(MAX_PER_ORG * 3);

          if (!customers?.length) continue;
          const ids = customers.map((c) => c.id);

          // Quais já têm embedding?
          const { data: existing } = await supabaseAdmin
            .from('customer_embeddings')
            .select('erp_customer_id')
            .eq('organization_id', o.id)
            .in('erp_customer_id', ids);
          const has = new Set((existing ?? []).map((e) => e.erp_customer_id));
          const pending = customers.filter((c) => !has.has(c.id)).slice(0, MAX_PER_ORG);
          if (!pending.length) continue;

          // Métricas
          const { data: metrics } = await supabaseAdmin
            .from('erp_customer_metrics')
            .select(
              'erp_customer_id, recency_days, frequency_365d, monetary_365d, avg_ticket, rfm_segment, last_order_at',
            )
            .eq('organization_id', o.id)
            .in('erp_customer_id', pending.map((c) => c.id));
          const mById = new Map((metrics ?? []).map((m) => [m.erp_customer_id, m] as const));

          let indexed = 0;
          let skipped = 0;
          for (const c of pending) {
            const m = mById.get(c.id);
            const text = [
              `Cliente: ${c.trade_name ?? c.legal_name ?? '—'}`,
              c.document ? `CNPJ: ${c.document}` : null,
              c.city || c.state ? `Localização: ${[c.city, c.state].filter(Boolean).join('/')}` : null,
              c.segment ? `Segmento: ${c.segment}` : null,
              m?.rfm_segment ? `RFM: ${m.rfm_segment}` : null,
              m?.recency_days != null ? `Recência: ${m.recency_days}d` : null,
              m?.frequency_365d != null ? `Freq 365d: ${m.frequency_365d}` : null,
              m?.monetary_365d != null ? `Mon 365d: R$ ${m.monetary_365d}` : null,
              m?.avg_ticket != null ? `Ticket: R$ ${m.avg_ticket}` : null,
              m?.last_order_at ? `Última: ${String(m.last_order_at).slice(0, 10)}` : null,
            ]
              .filter(Boolean)
              .join('\n');

            const vec = await embed(text);
            if (!vec) {
              skipped++;
              continue;
            }
            const { error: upErr } = await supabaseAdmin.from('customer_embeddings').upsert(
              {
                organization_id: o.id,
                erp_customer_id: c.id,
                embedding: vec as unknown as string,
                source_text: text,
                model: EMBED_MODEL,
                computed_at: new Date().toISOString(),
              },
              { onConflict: 'organization_id,erp_customer_id' },
            );
            if (upErr) skipped++;
            else indexed++;
          }

          totalIndexed += indexed;
          totalSkipped += skipped;
          perOrg.push({ org: o.id, indexed, skipped });
        }

        return Response.json({
          ok: true,
          orgs: orgs?.length ?? 0,
          totalIndexed,
          totalSkipped,
          perOrg,
        });
      },
    },
  },
});
