import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });
const DAY = 86400000;

type Detection = {
  id: string;
  title: string;
  subtitle?: string;
  metric?: string;
  reason: string;
  severity: "info" | "warn" | "high";
  href?: string;
};

type AgentBundle = {
  followup: Detection[];
  opportunities: Detection[];
  risks: Detection[];
  reps: Detection[];
  stats: {
    followupOverdue: number;
    upsellPotential: number;
    atRiskRevenue: number;
    activeReps: number;
  };
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Suíte IA Comercial — 4 agentes que olham os MESMOS dados sob lentes diferentes:
 *  - Follow-up: o que está parado e precisa de toque
 *  - Oportunidades: onde existe upsell/recompra
 *  - Risco: quem está sumindo / inadimplente
 *  - Representantes: ranking + gaps de cobertura
 *
 * Tudo determinístico (heurísticas em SQL/JS sobre dados reais). O LLM entra
 * apenas no "Brief IA" sob demanda (ver aiAgentBrief).
 */
export const getSalesAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }): Promise<AgentBundle> => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();

    const [dealsRes, actsRes, invRes, compRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, title, value, stage, expected_close, updated_at, company_id, user_id, closed_at, companies(name)")
        .eq("organization_id", org),
      supabase
        .from("activities")
        .select("id, deal_id, company_id:contact_id, completed, due_date, created_at, user_id")
        .eq("organization_id", org)
        .gte("created_at", new Date(now - 90 * DAY).toISOString()),
      supabase
        .from("invoices")
        .select("id, company_id, amount, status, due_date, paid_at")
        .eq("organization_id", org),
      supabase
        .from("companies")
        .select("id, name, industry")
        .eq("organization_id", org),
    ]);

    if (dealsRes.error) throw new Error(dealsRes.error.message);
    const deals = dealsRes.data ?? [];
    const acts = actsRes.data ?? [];
    const invoices = invRes.data ?? [];
    const companies = compRes.data ?? [];

    const compName = new Map(companies.map((c) => [c.id, c.name]));

    // Última atividade por deal
    const lastActByDeal = new Map<string, number>();
    for (const a of acts) {
      if (!a.deal_id) continue;
      const t = a.due_date ? new Date(a.due_date).getTime() : new Date(a.created_at).getTime();
      const cur = lastActByDeal.get(a.deal_id) ?? 0;
      if (t > cur) lastActByDeal.set(a.deal_id, t);
    }

    // ---------- AGENTE FOLLOW-UP ----------
    const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const followup: Detection[] = openDeals
      .map((d) => {
        const last = lastActByDeal.get(d.id) ?? new Date(d.updated_at).getTime();
        const daysSilent = Math.floor((now - last) / DAY);
        return { d, daysSilent };
      })
      .filter((x) => x.daysSilent >= 7)
      .sort((a, b) => Number(b.d.value) - Number(a.d.value))
      .slice(0, 12)
      .map(({ d, daysSilent }) => ({
        id: d.id,
        title: d.title,
        subtitle: (d.companies as any)?.name ?? compName.get(d.company_id ?? "") ?? "—",
        metric: fmtBRL(Number(d.value)),
        reason: `${daysSilent} dias sem toque · estágio ${d.stage}`,
        severity: daysSilent > 21 ? "high" : daysSilent > 14 ? "warn" : "info",
        href: `/pipeline`,
      }));

    // ---------- AGENTE OPORTUNIDADES (upsell / recompra) ----------
    // Empresas com deals ganhos e SEM deal aberto → terreno fértil para upsell.
    const wonByCompany = new Map<string, { total: number; lastWonAt: number }>();
    for (const d of deals) {
      if (d.stage !== "won" || !d.company_id) continue;
      const v = wonByCompany.get(d.company_id) ?? { total: 0, lastWonAt: 0 };
      v.total += Number(d.value);
      const t = d.closed_at ? new Date(d.closed_at).getTime() : new Date(d.updated_at).getTime();
      if (t > v.lastWonAt) v.lastWonAt = t;
      wonByCompany.set(d.company_id, v);
    }
    const openByCompany = new Set(
      openDeals.map((d) => d.company_id).filter(Boolean) as string[],
    );
    const opportunities: Detection[] = [...wonByCompany.entries()]
      .filter(([cid]) => !openByCompany.has(cid))
      .map(([cid, v]) => {
        const days = Math.floor((now - v.lastWonAt) / DAY);
        return { cid, total: v.total, days };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
      .map(({ cid, total, days }) => ({
        id: cid,
        title: compName.get(cid) ?? "—",
        subtitle: "Sem oportunidade aberta",
        metric: fmtBRL(total),
        reason: `Última compra há ${days}d · histórico ${fmtBRL(total)} · pronto para upsell/recompra`,
        severity: days > 120 ? "high" : days > 60 ? "warn" : "info",
        href: `/companies/${cid}`,
      }));

    // ---------- AGENTE RISCO (churn + inadimplência) ----------
    const overdueByCompany = new Map<string, number>();
    for (const inv of invoices) {
      if (!inv.company_id) continue;
      const due = new Date(inv.due_date).getTime();
      const open = inv.status !== "paid" && !inv.paid_at && due < now;
      if (open) {
        overdueByCompany.set(inv.company_id, (overdueByCompany.get(inv.company_id) ?? 0) + Number(inv.amount));
      }
    }
    const riskFromOverdue: Detection[] = [...overdueByCompany.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cid, amt]) => ({
        id: `overdue-${cid}`,
        title: compName.get(cid) ?? "—",
        subtitle: "Inadimplência",
        metric: fmtBRL(amt),
        reason: `${fmtBRL(amt)} em títulos vencidos`,
        severity: "high" as const,
        href: `/companies/${cid}`,
      }));
    const riskFromInactivity: Detection[] = [...wonByCompany.entries()]
      .map(([cid, v]) => ({ cid, days: Math.floor((now - v.lastWonAt) / DAY), total: v.total }))
      .filter((x) => x.days > 90 && !overdueByCompany.has(x.cid))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((x) => ({
        id: `silent-${x.cid}`,
        title: compName.get(x.cid) ?? "—",
        subtitle: "Cliente silencioso",
        metric: fmtBRL(x.total),
        reason: `${x.days}d sem comprar · histórico ${fmtBRL(x.total)}`,
        severity: x.days > 180 ? ("high" as const) : ("warn" as const),
        href: `/companies/${x.cid}`,
      }));
    const risks = [...riskFromOverdue, ...riskFromInactivity].slice(0, 15);

    // ---------- AGENTE REPRESENTANTES ----------
    type RepAgg = { open: number; won30: number; acts30: number; deals: number };
    const reps = new Map<string, RepAgg>();
    const ts30 = now - 30 * DAY;
    for (const d of deals) {
      const r = reps.get(d.user_id) ?? { open: 0, won30: 0, acts30: 0, deals: 0 };
      r.deals += 1;
      if (d.stage !== "won" && d.stage !== "lost") r.open += Number(d.value);
      const closedTs = d.closed_at ? new Date(d.closed_at).getTime() : 0;
      if (d.stage === "won" && closedTs > ts30) r.won30 += Number(d.value);
      reps.set(d.user_id, r);
    }
    for (const a of acts) {
      const at = a.due_date ? new Date(a.due_date).getTime() : new Date(a.created_at).getTime();
      if (at < ts30) continue;
      const r = reps.get(a.user_id) ?? { open: 0, won30: 0, acts30: 0, deals: 0 };
      r.acts30 += 1;
      reps.set(a.user_id, r);
    }
    const repDetections: Detection[] = [...reps.entries()]
      .sort((a, b) => b[1].won30 - a[1].won30)
      .slice(0, 10)
      .map(([uid, r], idx) => {
        const low = r.acts30 < 10;
        return {
          id: uid,
          title: `Representante #${idx + 1}`,
          subtitle: `${r.deals} negócios na carteira`,
          metric: fmtBRL(r.won30),
          reason: low
            ? `Apenas ${r.acts30} atividades em 30d · cobertura baixa · pipeline aberto ${fmtBRL(r.open)}`
            : `${r.acts30} atividades em 30d · pipeline aberto ${fmtBRL(r.open)}`,
          severity: low ? ("warn" as const) : ("info" as const),
        };
      });

    return {
      followup,
      opportunities,
      risks,
      reps: repDetections,
      stats: {
        followupOverdue: followup.length,
        upsellPotential: opportunities.reduce((s, o) => s + Number((o.metric ?? "0").replace(/\D/g, "")) / 100, 0),
        atRiskRevenue: riskFromOverdue.reduce((s, r) => s + Number((r.metric ?? "0").replace(/\D/g, "")) / 100, 0),
        activeReps: reps.size,
      },
    };
  });

// ---------- BRIEF IA (LLM sob demanda) ----------
const briefInput = z.object({
  organization_id: z.string().uuid(),
  agent: z.enum(["followup", "opportunities", "risks", "reps"]),
  context: z.string().max(4000),
});

async function callLovableAI(systemPrompt: string, userPrompt: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (res.status === 429) throw new Error("Limite de uso de IA atingido. Tente novamente em instantes.");
  if (res.status === 402) throw new Error("Créditos de IA insuficientes. Adicione créditos em Configurações.");
  if (!res.ok) throw new Error(`IA falhou: ${res.status}`);
  const j = await res.json();
  return (j?.choices?.[0]?.message?.content ?? "").toString();
}

const ROLE: Record<string, string> = {
  followup:
    "Você é um Diretor Comercial. Analise os negócios parados e diga em PT-BR (máx 4 bullets) o plano de ataque para hoje: por onde começar, qual canal usar e qual frase abrir.",
  opportunities:
    "Você é um Diretor Comercial focado em expansão. Analise as oportunidades de upsell/recompra e diga em PT-BR (máx 4 bullets) onde estão os melhores ganhos rápidos e qual oferta propor em cada um.",
  risks:
    "Você é um Diretor de Sucesso do Cliente. Analise os clientes em risco e diga em PT-BR (máx 4 bullets) o que fazer para reter cada um, com prazo e canal sugerido.",
  reps:
    "Você é um Gerente Comercial. Analise o ranking de representantes e aponte em PT-BR (máx 4 bullets) quem precisa de coaching, quem deve receber mais carteira e que práticas dos top performers replicar.",
};

export const aiAgentBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => briefInput.parse(i))
  .handler(async ({ data }) => {
    const out = await callLovableAI(ROLE[data.agent], data.context);
    return { result: out };
  });
