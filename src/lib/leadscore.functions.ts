import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  organization_id: z.string().uuid(),
  limit: z.number().int().min(10).max(500).default(100),
});

type ContactScore = {
  contact_id: string;
  name: string;
  email: string | null;
  company_id: string | null;
  company_name: string | null;
  score: number;
  tier: "hot" | "warm" | "cold";
  signals: string[];
  pipelineValue: number;
  openDeals: number;
  wonDeals: number;
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
  reason: string;
};

const STAGE_WEIGHTS: Record<string, number> = {
  lead: 5,
  qualified: 15,
  proposal: 30,
  negotiation: 45,
  won: 0,
  lost: 0,
};

export const getLeadScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();

    const [contactsRes, dealsRes, activitiesRes, companiesRes] = await Promise.all([
      supabase.from("contacts").select("id, name, email, company_id").eq("organization_id", org),
      supabase.from("deals").select("id, contact_id, value, stage, updated_at, closed_at").eq("organization_id", org),
      supabase
        .from("activities")
        .select("contact_id, type, completed, created_at, due_date")
        .eq("organization_id", org)
        .gte("created_at", new Date(now - 90 * 86400_000).toISOString()),
      supabase.from("companies").select("id, name").eq("organization_id", org),
    ]);

    const contacts = contactsRes.data ?? [];
    const deals = dealsRes.data ?? [];
    const acts = activitiesRes.data ?? [];
    const companies = Object.fromEntries((companiesRes.data ?? []).map((c) => [c.id, c.name]));

    // Group by contact
    const dealsByContact = new Map<string, typeof deals>();
    for (const d of deals) {
      if (!d.contact_id) continue;
      const arr = dealsByContact.get(d.contact_id) ?? [];
      arr.push(d);
      dealsByContact.set(d.contact_id, arr);
    }
    const actsByContact = new Map<string, typeof acts>();
    for (const a of acts) {
      if (!a.contact_id) continue;
      const arr = actsByContact.get(a.contact_id) ?? [];
      arr.push(a);
      actsByContact.set(a.contact_id, arr);
    }

    const scored: ContactScore[] = contacts.map((c) => {
      const cDeals = dealsByContact.get(c.id) ?? [];
      const cActs = actsByContact.get(c.id) ?? [];
      const open = cDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");
      const won = cDeals.filter((d) => d.stage === "won");
      const lost = cDeals.filter((d) => d.stage === "lost");
      const pipelineValue = open.reduce((s, d) => s + Number(d.value || 0), 0);
      const wonValue = won.reduce((s, d) => s + Number(d.value || 0), 0);

      const signals: string[] = [];
      let score = 0;

      // Stage weight (best deal stage)
      const bestStageScore = Math.max(0, ...open.map((d) => STAGE_WEIGHTS[d.stage] ?? 0));
      if (bestStageScore > 0) {
        score += bestStageScore;
        signals.push(`Em ${open.find((d) => STAGE_WEIGHTS[d.stage] === bestStageScore)?.stage}`);
      }

      // Value buckets
      if (pipelineValue >= 100_000) { score += 25; signals.push("Pipeline > 100k"); }
      else if (pipelineValue >= 20_000) { score += 15; signals.push("Pipeline relevante"); }
      else if (pipelineValue > 0) { score += 5; }

      // Activity recency
      const allDates = [
        ...cActs.map((a) => new Date(a.created_at).getTime()),
        ...cDeals.map((d) => new Date(d.updated_at).getTime()),
      ];
      const lastActivity = allDates.length ? Math.max(...allDates) : null;
      const daysSince = lastActivity ? Math.floor((now - lastActivity) / 86400_000) : null;
      if (daysSince != null) {
        if (daysSince <= 3) { score += 20; signals.push("Ativo nos últimos 3 dias"); }
        else if (daysSince <= 14) { score += 10; signals.push("Ativo nas últimas 2 semanas"); }
        else if (daysSince <= 30) { score += 3; }
        else if (daysSince > 60) { score -= 10; signals.push("Esfriou (>60d sem contato)"); }
      } else {
        score -= 5;
        signals.push("Sem atividade registrada");
      }

      // Engagement (completed activities)
      const completed = cActs.filter((a) => a.completed).length;
      if (completed >= 5) { score += 10; signals.push("Muito engajado"); }
      else if (completed >= 2) { score += 5; }

      // Customer history
      if (won.length > 0) { score += 8; signals.push("Já comprou antes"); }
      if (lost.length > 0 && open.length === 0) {
        score -= 8;
        signals.push("Perdeu negócio anterior");
      }

      // Overdue tasks penalty
      const overdue = cActs.filter((a) => !a.completed && a.due_date && new Date(a.due_date).getTime() < now).length;
      if (overdue > 0) { score -= 5; signals.push(`${overdue} tarefa(s) atrasada(s)`); }

      score = Math.max(0, Math.min(100, score));
      const tier: ContactScore["tier"] = score >= 60 ? "hot" : score >= 30 ? "warm" : "cold";

      // Reason / next action
      let reason = "Sem ações sugeridas.";
      if (overdue > 0) reason = "Limpar tarefas atrasadas é prioridade.";
      else if (tier === "hot" && open.length > 0) reason = "Avance o negócio aberto agora — está quente.";
      else if (tier === "hot") reason = "Abrir oportunidade — contato pronto para comprar.";
      else if (tier === "warm" && daysSince != null && daysSince > 14) reason = "Reaqueça com um follow-up.";
      else if (tier === "cold" && won.length > 0) reason = "Cliente antigo: reativar com novo pitch.";
      else if (tier === "cold") reason = "Nutrir com conteúdo antes de novo contato.";

      return {
        contact_id: c.id,
        name: c.name,
        email: c.email,
        company_id: c.company_id,
        company_name: c.company_id ? companies[c.company_id] ?? null : null,
        score: Math.round(score),
        tier,
        signals,
        pipelineValue,
        openDeals: open.length,
        wonDeals: won.length,
        lastActivityAt: lastActivity ? new Date(lastActivity).toISOString() : null,
        daysSinceActivity: daysSince,
        reason,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const summary = {
      total: scored.length,
      hot: scored.filter((s) => s.tier === "hot").length,
      warm: scored.filter((s) => s.tier === "warm").length,
      cold: scored.filter((s) => s.tier === "cold").length,
      hotPipeline: scored.filter((s) => s.tier === "hot").reduce((a, b) => a + b.pipelineValue, 0),
    };

    return { summary, items: scored.slice(0, data.limit) };
  });
