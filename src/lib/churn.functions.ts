import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });
const DAY = 86400000;

// Score de churn por empresa + sugestões de expansão.
export const getRetentionInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;

    const [companiesRes, dealsRes, activitiesRes, contactsRes] = await Promise.all([
      supabase.from("companies").select("id, name, industry, size, created_at").eq("organization_id", org),
      supabase.from("deals").select("id, company_id, stage, value, updated_at, created_at").eq("organization_id", org),
      supabase.from("activities").select("id, contact_id, deal_id, completed, due_date, created_at").eq("organization_id", org),
      supabase.from("contacts").select("id, company_id").eq("organization_id", org),
    ]);

    const companies = companiesRes.data ?? [];
    const deals = dealsRes.data ?? [];
    const activities = activitiesRes.data ?? [];
    const contacts = contactsRes.data ?? [];

    const contactByCompany = new Map<string, string[]>();
    for (const c of contacts) {
      if (!c.company_id) continue;
      const arr = contactByCompany.get(c.company_id) ?? [];
      arr.push(c.id);
      contactByCompany.set(c.company_id, arr);
    }

    const now = Date.now();

    const rows = companies.map((co) => {
      const coDeals = deals.filter((d) => d.company_id === co.id);
      const won = coDeals.filter((d) => d.stage === "won");
      const lost = coDeals.filter((d) => d.stage === "lost");
      const open = coDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");

      const coContactIds = contactByCompany.get(co.id) ?? [];
      const relevantActivities = activities.filter(
        (a) =>
          (a.contact_id && coContactIds.includes(a.contact_id)) ||
          (a.deal_id && coDeals.some((d) => d.id === a.deal_id)),
      );

      const lastTouchTs = Math.max(
        0,
        ...coDeals.map((d) => new Date(d.updated_at).getTime()),
        ...relevantActivities.map((a) => new Date(a.created_at).getTime()),
      );
      const daysSilent = lastTouchTs ? Math.floor((now - lastTouchTs) / DAY) : 9999;

      const wonValue = won.reduce((s, d) => s + Number(d.value || 0), 0);
      const openValue = open.reduce((s, d) => s + Number(d.value || 0), 0);
      const lossRate = coDeals.length ? lost.length / coDeals.length : 0;

      // Score de risco 0-100
      let risk = 0;
      const reasons: string[] = [];
      if (daysSilent >= 90) { risk += 45; reasons.push(`${daysSilent}d sem contato`); }
      else if (daysSilent >= 60) { risk += 30; reasons.push(`${daysSilent}d sem contato`); }
      else if (daysSilent >= 30) { risk += 15; reasons.push(`${daysSilent}d sem contato`); }

      if (lossRate >= 0.5 && coDeals.length >= 2) { risk += 20; reasons.push("Histórico de perdas alto"); }
      if (open.length === 0 && won.length > 0) { risk += 15; reasons.push("Cliente sem deal ativo"); }
      if (coContactIds.length === 0) { risk += 10; reasons.push("Sem contato vinculado"); }

      risk = Math.min(100, risk);

      const level: "saudavel" | "atencao" | "risco" =
        risk >= 60 ? "risco" : risk >= 30 ? "atencao" : "saudavel";

      // Sugestões de expansão
      const expansion: string[] = [];
      if (won.length > 0 && open.length === 0) {
        expansion.push("Cliente ativo sem nova oportunidade — abrir conversa de upsell.");
      }
      if (won.length >= 2) {
        expansion.push("Cliente recorrente — pedir indicação / case.");
      }
      if (wonValue > 0 && openValue < wonValue * 0.3) {
        expansion.push("Pipeline aberto < 30% do histórico — explorar novos produtos.");
      }

      return {
        company_id: co.id,
        name: co.name,
        industry: co.industry,
        size: co.size,
        risk,
        level,
        days_silent: daysSilent === 9999 ? null : daysSilent,
        deals_total: coDeals.length,
        deals_won: won.length,
        deals_lost: lost.length,
        deals_open: open.length,
        won_value: wonValue,
        open_value: openValue,
        reasons,
        expansion_signals: expansion,
      };
    });

    rows.sort((a, b) => b.risk - a.risk);

    const summary = {
      total: rows.length,
      em_risco: rows.filter((r) => r.level === "risco").length,
      atencao: rows.filter((r) => r.level === "atencao").length,
      saudaveis: rows.filter((r) => r.level === "saudavel").length,
      expansion_opportunities: rows.filter((r) => r.expansion_signals.length > 0).length,
    };

    return { rows, summary };
  });
