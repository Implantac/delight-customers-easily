import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });
const DAY = 86400000;

export type WalletRow = {
  company_id: string;
  name: string;
  industry: string | null;
  size: string | null;
  wonRevenue: number;
  openPipeline: number;
  lastPurchaseAt: string | null;
  daysSinceLastPurchase: number | null;
  ticketAvg: number;
  frequency: number; // pedidos nos últimos 12m
  activitiesLast30: number;
  overdueAmount: number;
  score: number; // 0-100
  status: "ativo" | "atencao" | "risco" | "novo" | "inativo";
  buckets: Array<"visitar" | "reativar" | "risco" | "sem_contato" | "inadimplente">;
};

/**
 * Carteira Comercial — visão única e densa do relacionamento por empresa.
 * Tudo agregado server-side a partir de dados reais (companies, deals,
 * activities, invoices). Sem mocks.
 */
export const getCommercialWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();
    const ts30 = now - 30 * DAY;
    const ts365 = now - 365 * DAY;

    const [companiesRes, dealsRes, actsRes, invRes] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, industry, size, created_at")
        .eq("organization_id", org),
      supabase
        .from("deals")
        .select("id, company_id, value, stage, closed_at, updated_at")
        .eq("organization_id", org),
      supabase
        .from("activities")
        .select("id, deal_id, contact_id, due_date, created_at")
        .eq("organization_id", org)
        .gte("created_at", new Date(ts30).toISOString()),
      supabase
        .from("invoices")
        .select("id, company_id, amount, status, due_date, paid_at")
        .eq("organization_id", org),
    ]);

    if (companiesRes.error) throw new Error(companiesRes.error.message);
    const companies = companiesRes.data ?? [];
    const deals = dealsRes.data ?? [];
    const acts = actsRes.data ?? [];
    const invoices = invRes.data ?? [];

    // Index contact->company para atividades sem deal
    const { data: contactList } = await supabase
      .from("contacts")
      .select("id, company_id")
      .eq("organization_id", org);
    const compByContact = new Map<string, string>();
    for (const c of contactList ?? []) {
      if (c.company_id) compByContact.set(c.id, c.company_id);
    }
    const compByDeal = new Map<string, string>();
    for (const d of deals) if (d.company_id) compByDeal.set(d.id, d.company_id);

    const rows: WalletRow[] = companies.map((co) => {
      const coDeals = deals.filter((d) => d.company_id === co.id);
      const won = coDeals.filter((d) => d.stage === "won");
      const open = coDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");

      const wonRevenue = won.reduce((s, d) => s + Number(d.value), 0);
      const openPipeline = open.reduce((s, d) => s + Number(d.value), 0);

      const wonTs = won
        .map((d) => (d.closed_at ? new Date(d.closed_at).getTime() : new Date(d.updated_at).getTime()))
        .sort((a, b) => b - a);
      const lastPurchaseTs = wonTs[0] ?? null;
      const frequency = won.filter((d) => {
        const t = d.closed_at ? new Date(d.closed_at).getTime() : new Date(d.updated_at).getTime();
        return t >= ts365;
      }).length;
      const ticketAvg = won.length > 0 ? wonRevenue / won.length : 0;

      const activitiesLast30 = acts.filter((a) => {
        const cid = a.deal_id ? compByDeal.get(a.deal_id) : a.contact_id ? compByContact.get(a.contact_id) : null;
        return cid === co.id;
      }).length;

      const overdueAmount = invoices
        .filter((inv) => inv.company_id === co.id && inv.status !== "paid" && !inv.paid_at)
        .filter((inv) => new Date(inv.due_date).getTime() < now)
        .reduce((s, inv) => s + Number(inv.amount), 0);

      const daysSince = lastPurchaseTs ? Math.floor((now - lastPurchaseTs) / DAY) : null;

      // Score 0-100: histórico + recência + atividade + penaliza inadimplência
      let score = 0;
      score += Math.min(40, wonRevenue / 1000); // até 40 pelo histórico (R$40k = 40)
      if (daysSince !== null) score += Math.max(0, 30 - daysSince / 5); // 30 se comprou hoje, decai
      score += Math.min(20, activitiesLast30 * 4);
      score += Math.min(10, frequency * 2);
      if (overdueAmount > 0) score -= 20;
      score = Math.max(0, Math.min(100, Math.round(score)));

      // Status / buckets
      const buckets: WalletRow["buckets"] = [];
      let status: WalletRow["status"];
      const createdRecently = new Date(co.created_at).getTime() > now - 30 * DAY;

      if (won.length === 0 && createdRecently) status = "novo";
      else if (overdueAmount > 0) status = "risco";
      else if (daysSince !== null && daysSince > 180) status = "inativo";
      else if (daysSince !== null && daysSince > 90) status = "atencao";
      else if (won.length === 0 && !createdRecently) status = "inativo";
      else status = "ativo";

      if (overdueAmount > 0) buckets.push("inadimplente");
      if (daysSince !== null && daysSince >= 60 && daysSince <= 180) buckets.push("reativar");
      if (daysSince !== null && daysSince > 180) buckets.push("risco");
      if (activitiesLast30 === 0) buckets.push("sem_contato");
      if (openPipeline > 0 && activitiesLast30 === 0) buckets.push("visitar");
      // "visitar" extra: ticket alto + 30-60d sem comprar
      if (ticketAvg > 5000 && daysSince !== null && daysSince >= 30 && daysSince < 60) {
        buckets.push("visitar");
      }

      return {
        company_id: co.id,
        name: co.name,
        industry: co.industry,
        size: co.size,
        wonRevenue,
        openPipeline,
        lastPurchaseAt: lastPurchaseTs ? new Date(lastPurchaseTs).toISOString() : null,
        daysSinceLastPurchase: daysSince,
        ticketAvg,
        frequency,
        activitiesLast30,
        overdueAmount,
        score,
        status,
        buckets: Array.from(new Set(buckets)),
      };
    });

    rows.sort((a, b) => b.score - a.score);

    return {
      rows,
      industries: Array.from(new Set(rows.map((r) => r.industry).filter(Boolean))) as string[],
      summary: {
        total: rows.length,
        active: rows.filter((r) => r.status === "ativo").length,
        attention: rows.filter((r) => r.status === "atencao").length,
        risk: rows.filter((r) => r.status === "risco").length,
        inactive: rows.filter((r) => r.status === "inativo").length,
        totalOpen: rows.reduce((s, r) => s + r.openPipeline, 0),
        totalOverdue: rows.reduce((s, r) => s + r.overdueAmount, 0),
      },
    };
  });
