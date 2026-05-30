import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });
const DAY = 86400000;

export type OppType =
  | "high_value"        // deals abertos de maior valor (priorizar fechamento)
  | "recovery"          // clientes que pararam de comprar
  | "upsell"            // clientes ativos sem oportunidade aberta
  | "cross_sell"        // clientes com poucos produtos distintos
  | "stalled"           // deals parados há muito tempo
  | "overdue"           // clientes inadimplentes com pipeline aberto
  | "hot_lead";         // leads recentes não convertidos

export type Opportunity = {
  id: string;
  type: OppType;
  title: string;
  subtitle: string;
  company_id: string | null;
  deal_id: string | null;
  value: number;
  score: number;       // 0-100 prioridade
  reason: string;
  action_label: string;
  action_href: string;
};

const TYPE_META: Record<OppType, { label: string; tone: string }> = {
  high_value: { label: "Alto valor", tone: "primary" },
  recovery:   { label: "Recuperação", tone: "amber" },
  upsell:     { label: "Upsell", tone: "emerald" },
  cross_sell: { label: "Cross-sell", tone: "violet" },
  stalled:    { label: "Parado", tone: "destructive" },
  overdue:    { label: "Inadimplente c/ pipeline", tone: "destructive" },
  hot_lead:   { label: "Lead quente", tone: "primary" },
};

export const TYPE_LABELS = Object.fromEntries(
  Object.entries(TYPE_META).map(([k, v]) => [k, v.label]),
) as Record<OppType, string>;

export const TYPE_TONES = Object.fromEntries(
  Object.entries(TYPE_META).map(([k, v]) => [k, v.tone]),
) as Record<OppType, string>;

export const getOpportunitiesCentral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();

    const [compRes, dealsRes, actsRes, invRes, itemsRes, leadsRes] = await Promise.all([
      supabase.from("companies").select("id, name, industry, size").eq("organization_id", org),
      supabase.from("deals").select("id, title, value, stage, company_id, updated_at, expected_close, closed_at").eq("organization_id", org),
      supabase.from("activities").select("id, deal_id, contact_id, created_at").eq("organization_id", org).gte("created_at", new Date(now - 60 * DAY).toISOString()),
      supabase.from("invoices").select("id, company_id, amount, status, due_date, paid_at").eq("organization_id", org),
      supabase.from("order_items").select("company_id, product_id").eq("organization_id", org).limit(2000),
      supabase.from("marketing_leads").select("id, name, status, created_at, converted_deal_id").eq("organization_id", org).gte("created_at", new Date(now - 30 * DAY).toISOString()),
    ]);

    const companies = compRes.data ?? [];
    const deals = dealsRes.data ?? [];
    const acts = actsRes.data ?? [];
    const invoices = (invRes.data ?? []) as any[];
    const items = (itemsRes.data ?? []) as any[];
    const leads = leadsRes.data ?? [];

    const compById = new Map(companies.map((c) => [c.id, c]));
    const opps: Opportunity[] = [];

    // ---------- 1. High value open deals ----------
    const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const maxVal = Math.max(1, ...openDeals.map((d) => Number(d.value || 0)));
    for (const d of openDeals
      .slice()
      .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
      .slice(0, 15)) {
      const c = d.company_id ? compById.get(d.company_id) : null;
      const v = Number(d.value || 0);
      const score = Math.round(60 + (v / maxVal) * 40);
      opps.push({
        id: `hv-${d.id}`,
        type: "high_value",
        title: d.title,
        subtitle: c?.name ?? "Sem empresa",
        company_id: d.company_id ?? null,
        deal_id: d.id,
        value: v,
        score,
        reason: `Etapa: ${d.stage}. Maior valor em aberto.`,
        action_label: "Abrir no pipeline",
        action_href: "/pipeline",
      });
    }

    // ---------- 2. Stalled deals (sem atividade >21d) ----------
    const actByDeal = new Map<string, number>();
    for (const a of acts) {
      if (!a.deal_id) continue;
      const t = new Date(a.created_at).getTime();
      const prev = actByDeal.get(a.deal_id) ?? 0;
      if (t > prev) actByDeal.set(a.deal_id, t);
    }
    for (const d of openDeals) {
      const lastAct = actByDeal.get(d.id) ?? new Date(d.updated_at).getTime();
      const days = Math.floor((now - lastAct) / DAY);
      if (days < 21) continue;
      const v = Number(d.value || 0);
      const c = d.company_id ? compById.get(d.company_id) : null;
      opps.push({
        id: `st-${d.id}`,
        type: "stalled",
        title: d.title,
        subtitle: c?.name ?? "Sem empresa",
        company_id: d.company_id ?? null,
        deal_id: d.id,
        value: v,
        score: Math.min(95, 50 + days),
        reason: `${days}d sem atividade.`,
        action_label: "Retomar contato",
        action_href: "/pipeline",
      });
    }

    // ---------- 3. Upsell: cliente ativo (won) sem deal aberto ----------
    const wonByCompany = new Map<string, { count: number; lastTs: number; total: number }>();
    for (const d of deals.filter((x) => x.stage === "won" && x.company_id)) {
      const cur = wonByCompany.get(d.company_id!) ?? { count: 0, lastTs: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(d.value || 0);
      const t = d.closed_at ? new Date(d.closed_at).getTime() : new Date(d.updated_at).getTime();
      if (t > cur.lastTs) cur.lastTs = t;
      wonByCompany.set(d.company_id!, cur);
    }
    const openByCompany = new Set(openDeals.map((d) => d.company_id).filter(Boolean));
    for (const [cid, info] of wonByCompany) {
      if (openByCompany.has(cid)) continue;
      const c = compById.get(cid);
      if (!c) continue;
      const daysSince = Math.floor((now - info.lastTs) / DAY);
      // Recovery se passou muito tempo; upsell se ainda recente
      if (daysSince > 120) {
        opps.push({
          id: `rec-${cid}`,
          type: "recovery",
          title: c.name,
          subtitle: `${daysSince}d desde a última compra · histórico ${brl(info.total)}`,
          company_id: cid,
          deal_id: null,
          value: info.total / Math.max(1, info.count),
          score: Math.min(90, 40 + Math.floor(daysSince / 10)),
          reason: "Cliente parou de comprar.",
          action_label: "Reativar cliente",
          action_href: `/companies/${cid}`,
        });
      } else if (daysSince < 90) {
        opps.push({
          id: `up-${cid}`,
          type: "upsell",
          title: c.name,
          subtitle: `Ativo · ${info.count} venda${info.count > 1 ? "s" : ""} · sem oportunidade aberta`,
          company_id: cid,
          deal_id: null,
          value: info.total / Math.max(1, info.count),
          score: Math.min(85, 50 + info.count * 5),
          reason: "Cliente quente sem novo deal.",
          action_label: "Abrir oportunidade",
          action_href: `/companies/${cid}`,
        });
      }
    }

    // ---------- 4. Cross-sell: clientes com poucos produtos distintos ----------
    const productsByCompany = new Map<string, Set<string>>();
    for (const it of items) {
      if (!it.company_id || !it.product_id) continue;
      const s = productsByCompany.get(it.company_id) ?? new Set<string>();
      s.add(it.product_id);
      productsByCompany.set(it.company_id, s);
    }
    const avgProducts = (() => {
      const counts = [...productsByCompany.values()].map((s) => s.size);
      return counts.length ? counts.reduce((s, x) => s + x, 0) / counts.length : 0;
    })();
    if (avgProducts > 0) {
      for (const [cid, s] of productsByCompany) {
        if (s.size >= avgProducts || s.size >= 3) continue;
        const c = compById.get(cid);
        const info = wonByCompany.get(cid);
        if (!c || !info) continue;
        opps.push({
          id: `cs-${cid}`,
          type: "cross_sell",
          title: c.name,
          subtitle: `Comprou apenas ${s.size} produto${s.size > 1 ? "s" : ""} (média da carteira: ${avgProducts.toFixed(1)})`,
          company_id: cid,
          deal_id: null,
          value: info.total / Math.max(1, info.count),
          score: 55 + Math.round((avgProducts - s.size) * 5),
          reason: "Mix de produtos abaixo da média.",
          action_label: "Sugerir produtos",
          action_href: `/companies/${cid}`,
        });
      }
    }

    // ---------- 5. Overdue + pipeline aberto ----------
    const overdueByCo = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status === "paid" || inv.paid_at) continue;
      if (new Date(inv.due_date).getTime() >= now) continue;
      overdueByCo.set(inv.company_id, (overdueByCo.get(inv.company_id) ?? 0) + Number(inv.amount || 0));
    }
    for (const [cid, amt] of overdueByCo) {
      if (!openByCompany.has(cid)) continue;
      const c = compById.get(cid);
      if (!c) continue;
      opps.push({
        id: `od-${cid}`,
        type: "overdue",
        title: c.name,
        subtitle: `Pipeline aberto + ${brl(amt)} em atraso`,
        company_id: cid,
        deal_id: null,
        value: amt,
        score: 80,
        reason: "Cuidado: cobrar antes de avançar a venda.",
        action_label: "Ver cliente",
        action_href: `/companies/${cid}`,
      });
    }

    // ---------- 6. Hot leads não convertidos ----------
    for (const l of leads.filter((l) => !l.converted_deal_id && l.status !== "lost")) {
      const days = Math.floor((now - new Date(l.created_at).getTime()) / DAY);
      opps.push({
        id: `hl-${l.id}`,
        type: "hot_lead",
        title: l.name ?? "Lead sem nome",
        subtitle: `Lead há ${days}d · status ${l.status ?? "novo"}`,
        company_id: null,
        deal_id: null,
        value: 0,
        score: Math.max(40, 80 - days * 2),
        reason: "Lead recente ainda não virou negócio.",
        action_label: "Trabalhar lead",
        action_href: "/marketing",
      });
    }

    opps.sort((a, b) => b.score - a.score);

    const summary = {
      total: opps.length,
      total_value: opps.reduce((s, o) => s + o.value, 0),
      by_type: Object.keys(TYPE_META).reduce((acc, k) => {
        acc[k as OppType] = opps.filter((o) => o.type === k).length;
        return acc;
      }, {} as Record<OppType, number>),
    };

    return { opportunities: opps.slice(0, 200), summary };
  });

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
