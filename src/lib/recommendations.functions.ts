import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAY = 86400000;

const listInput = z.object({
  organization_id: z.string().uuid(),
  surface: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(6),
});

const resolveInput = z.object({
  organization_id: z.string().uuid(),
  id: z.string().uuid(),
  status: z.enum(["done", "dismissed"]),
});

const generateInput = z.object({
  organization_id: z.string().uuid(),
});

/**
 * List active recommendations for a given surface (e.g. "dashboard",
 * "pipeline", "carteira", "marketing"). Ordered by priority desc, then
 * expected $ impact desc. Cheap read — every screen calls this.
 */
export const listRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => listInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("recommendations")
      .select("*")
      .eq("organization_id", data.organization_id)
      .eq("surface", data.surface)
      .eq("status", "open")
      .order("priority", { ascending: false })
      .order("impact_brl", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const resolveRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => resolveInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("recommendations")
      .update({
        status: data.status,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type Draft = {
  surface: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string | null;
  priority: number;
  impact_brl?: number;
  title: string;
  reason: string;
  action_label: string;
  action_href: string;
  source: string;
};

/**
 * Regenerate the heuristic recommendation queue for the org.
 * Idempotent: wipes 'heuristic' open recs, then re-inserts based on current data.
 * AI-sourced recs (source='ai') are preserved.
 */
export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => generateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();

    const [dealsRes, actsRes, invRes, compRes, leadsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, title, value, stage, expected_close, updated_at, company_id, user_id, contact_id")
        .eq("organization_id", org),
      supabase
        .from("activities")
        .select("id, deal_id, completed, due_date, created_at, user_id")
        .eq("organization_id", org)
        .gte("created_at", new Date(now - 120 * DAY).toISOString()),
      supabase
        .from("invoices")
        .select("id, company_id, amount, status, due_date")
        .eq("organization_id", org),
      supabase
        .from("companies")
        .select("id, name")
        .eq("organization_id", org),
      supabase
        .from("marketing_leads")
        .select("id, name, status, channel, created_at, converted_deal_id")
        .eq("organization_id", org)
        .gte("created_at", new Date(now - 30 * DAY).toISOString())
        .limit(200),
    ]);

    const deals = dealsRes.data ?? [];
    const acts = actsRes.data ?? [];
    const invoices = (invRes.data ?? []) as any[];
    const companies = compRes.data ?? [];
    const leads = (leadsRes.data ?? []) as any[];
    const compName = new Map(companies.map((c: any) => [c.id, c.name]));

    const lastActByDeal = new Map<string, number>();
    for (const a of acts) {
      if (!a.deal_id) continue;
      const t = a.due_date ? new Date(a.due_date).getTime() : new Date(a.created_at).getTime();
      const cur = lastActByDeal.get(a.deal_id) ?? 0;
      if (t > cur) lastActByDeal.set(a.deal_id, t);
    }

    const drafts: Draft[] = [];

    // 1) Negócios silenciosos de alto valor (pipeline + dashboard)
    const openDeals = deals.filter((d: any) => d.stage !== "won" && d.stage !== "lost");
    const silent = openDeals
      .map((d: any) => {
        const last = lastActByDeal.get(d.id) ?? new Date(d.updated_at).getTime();
        const daysSilent = Math.floor((now - last) / DAY);
        return { d, daysSilent };
      })
      .filter((x) => x.daysSilent >= 7)
      .sort((a, b) => Number(b.d.value ?? 0) - Number(a.d.value ?? 0))
      .slice(0, 8);

    for (const { d, daysSilent } of silent) {
      const value = Number(d.value ?? 0);
      const priority = Math.min(95, 50 + Math.floor(daysSilent / 2) + (value > 50000 ? 15 : 0));
      drafts.push({
        surface: "pipeline",
        entity_type: "deal",
        entity_id: d.id,
        user_id: d.user_id ?? null,
        priority,
        impact_brl: value,
        title: `Negócio parado há ${daysSilent}d: ${d.title}`,
        reason: `${compName.get(d.company_id) ?? "Empresa"} • Estágio ${d.stage}. Sem atividade há ${daysSilent} dias.`,
        action_label: "Agendar follow-up",
        action_href: `/deals/${d.id}`,
        source: "heuristic",
      });
    }
    // Top 3 também aparecem no dashboard
    for (const { d, daysSilent } of silent.slice(0, 3)) {
      drafts.push({
        surface: "dashboard",
        entity_type: "deal",
        entity_id: d.id,
        user_id: d.user_id ?? null,
        priority: 85,
        impact_brl: Number(d.value ?? 0),
        title: `Retomar ${d.title}`,
        reason: `Parado há ${daysSilent}d • ${compName.get(d.company_id) ?? "—"}`,
        action_label: "Abrir negócio",
        action_href: `/deals/${d.id}`,
        source: "heuristic",
      });
    }

    // 2) Inadimplência (carteira + dashboard)
    const overdueByCompany = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status === "paid") continue;
      const due = inv.due_date ? new Date(inv.due_date).getTime() : 0;
      if (due && due < now) {
        overdueByCompany.set(
          inv.company_id,
          (overdueByCompany.get(inv.company_id) ?? 0) + Number(inv.amount ?? 0),
        );
      }
    }
    const overdueTop = [...overdueByCompany.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [companyId, amount] of overdueTop) {
      drafts.push({
        surface: "carteira",
        entity_type: "company",
        entity_id: companyId,
        priority: 90,
        impact_brl: amount,
        title: `Cobrar ${compName.get(companyId) ?? "cliente"}`,
        reason: `Faturas vencidas somam ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
        action_label: "Abrir cliente",
        action_href: `/contacts/${companyId}`,
        source: "heuristic",
      });
    }

    // 3) Leads novos não convertidos (marketing + dashboard)
    const hotLeads = leads
      .filter((l) => !l.converted_deal_id && l.status !== "lost" && l.status !== "won")
      .slice(0, 6);
    for (const l of hotLeads) {
      drafts.push({
        surface: "marketing",
        entity_type: "lead",
        entity_id: l.id,
        priority: 80,
        title: `Lead novo: ${l.name ?? "sem nome"}`,
        reason: `Canal ${l.channel} • status ${l.status}. Velocidade é tudo aqui.`,
        action_label: "Qualificar agora",
        action_href: `/leads`,
        source: "heuristic",
      });
    }
    for (const l of hotLeads.slice(0, 2)) {
      drafts.push({
        surface: "dashboard",
        entity_type: "lead",
        entity_id: l.id,
        priority: 75,
        title: `Atacar lead ${l.name ?? "novo"}`,
        reason: `Canal ${l.channel}`,
        action_label: "Abrir lead",
        action_href: `/leads`,
        source: "heuristic",
      });
    }

    // 4) Fechamento esperado em 7d (pipeline + dashboard)
    const in7 = now + 7 * DAY;
    const closingSoon = openDeals
      .filter((d: any) => d.expected_close && new Date(d.expected_close).getTime() <= in7)
      .sort((a: any, b: any) => Number(b.value ?? 0) - Number(a.value ?? 0))
      .slice(0, 5);
    for (const d of closingSoon) {
      drafts.push({
        surface: "pipeline",
        entity_type: "deal",
        entity_id: d.id,
        user_id: d.user_id ?? null,
        priority: 88,
        impact_brl: Number(d.value ?? 0),
        title: `Fechar ${d.title} em ${Math.max(1, Math.ceil((new Date(d.expected_close as string).getTime() - now) / DAY))}d`,
        reason: `Previsão de fechamento próxima. ${compName.get(d.company_id) ?? ""}`.trim(),
        action_label: "Acelerar negociação",
        action_href: `/deals/${d.id}`,
        source: "heuristic",
      });
    }

    // Wipe previous heuristic open recs, then bulk insert.
    await supabase
      .from("recommendations")
      .delete()
      .eq("organization_id", org)
      .eq("status", "open")
      .eq("source", "heuristic");

    if (drafts.length) {
      const rows = drafts.map((d) => ({ ...d, organization_id: org }));
      const { error } = await supabase.from("recommendations").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { generated: drafts.length };
  });
