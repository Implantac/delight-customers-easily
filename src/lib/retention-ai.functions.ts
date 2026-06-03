import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI, safeJSON } from "@/lib/ai-gateway.server";

const Input = z.object({
  organization_id: z.string().uuid(),
  max_companies: z.number().int().min(1).max(15).default(8),
});

export type RetentionAction = {
  company_id: string;
  company_name: string;
  risk: number;
  priority: "alta" | "media" | "baixa";
  diagnostico: string;
  acao_imediata: string;
  canal: "whatsapp" | "ligacao" | "email" | "visita";
  prazo_dias: number;
};

export type RetentionPlan = {
  resumo: string;
  acoes: RetentionAction[];
  generated_at: string;
};

const DAY = 86400000;

export const getRetentionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }): Promise<RetentionPlan> => {
    const { supabase } = context;
    const org = data.organization_id;

    const [companiesRes, dealsRes, activitiesRes, contactsRes] = await Promise.all([
      supabase.from("companies").select("id, name, industry").eq("organization_id", org),
      supabase.from("deals").select("id, company_id, stage, value, updated_at").eq("organization_id", org),
      supabase.from("activities").select("id, contact_id, deal_id, created_at").eq("organization_id", org),
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

    const scored = companies.map((co: any) => {
      const coDeals = deals.filter((d: any) => d.company_id === co.id);
      const won = coDeals.filter((d: any) => d.stage === "won");
      const lost = coDeals.filter((d: any) => d.stage === "lost");
      const open = coDeals.filter((d: any) => d.stage !== "won" && d.stage !== "lost");
      const coContactIds = contactByCompany.get(co.id) ?? [];
      const relAct = activities.filter(
        (a: any) =>
          (a.contact_id && coContactIds.includes(a.contact_id)) ||
          (a.deal_id && coDeals.some((d: any) => d.id === a.deal_id)),
      );
      const lastTs = Math.max(
        0,
        ...coDeals.map((d: any) => new Date(d.updated_at).getTime()),
        ...relAct.map((a: any) => new Date(a.created_at).getTime()),
      );
      const daysSilent = lastTs ? Math.floor((now - lastTs) / DAY) : 9999;
      const wonValue = won.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
      const openValue = open.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
      const lossRate = coDeals.length ? lost.length / coDeals.length : 0;

      let risk = 0;
      const reasons: string[] = [];
      if (daysSilent >= 90) { risk += 45; reasons.push(`${daysSilent}d sem contato`); }
      else if (daysSilent >= 60) { risk += 30; reasons.push(`${daysSilent}d sem contato`); }
      else if (daysSilent >= 30) { risk += 15; reasons.push(`${daysSilent}d sem contato`); }
      if (lossRate >= 0.5 && coDeals.length >= 2) { risk += 20; reasons.push("Histórico de perdas alto"); }
      if (open.length === 0 && won.length > 0) { risk += 15; reasons.push("Cliente sem deal ativo"); }
      if (coContactIds.length === 0) { risk += 10; reasons.push("Sem contato vinculado"); }
      risk = Math.min(100, risk);

      return {
        company_id: co.id,
        name: co.name,
        industry: co.industry,
        risk,
        days_silent: daysSilent === 9999 ? null : daysSilent,
        won_value: wonValue,
        open_value: openValue,
        reasons,
      };
    });

    const atRisk = scored
      .filter((r) => r.risk >= 30)
      .sort((a, b) => b.risk - a.risk)
      .slice(0, data.max_companies);

    if (atRisk.length === 0) {
      return {
        resumo: "Nenhum cliente em risco no momento. Foque em expansão da base saudável.",
        acoes: [],
        generated_at: new Date().toISOString(),
      };
    }

    const sys =
      "Você é um consultor sênior de retenção B2B. Responda APENAS JSON válido no schema solicitado, em português do Brasil, conciso e acionável. Não invente dados.";

    const user = `Clientes em risco (dados reais):
${JSON.stringify(atRisk)}

Gere um plano priorizado. Schema EXATO de saída (JSON):
{
  "resumo": "1-2 frases sobre o padrão geral e prioridade da semana",
  "acoes": [
    {
      "company_id": "<id>",
      "company_name": "<nome>",
      "risk": <0-100>,
      "priority": "alta" | "media" | "baixa",
      "diagnostico": "1 frase curta",
      "acao_imediata": "ação concreta no imperativo",
      "canal": "whatsapp" | "ligacao" | "email" | "visita",
      "prazo_dias": <int 1-14>
    }
  ]
}`;

    const res = await callLovableAI(
      [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.3, jsonMode: true },
    );

    const parsed = safeJSON<{ resumo: string; acoes: RetentionAction[] }>(res.content);
    if (!parsed || !Array.isArray(parsed.acoes)) {
      throw new Error("IA retornou resposta inválida. Tente novamente.");
    }

    const acoes: RetentionAction[] = parsed.acoes.map((a) => ({
      company_id: String(a.company_id ?? ""),
      company_name: String(a.company_name ?? ""),
      risk: Math.max(0, Math.min(100, Number(a.risk ?? 0))),
      priority: (["alta", "media", "baixa"] as const).includes(a.priority as any) ? a.priority : "media",
      diagnostico: String(a.diagnostico ?? "").slice(0, 280),
      acao_imediata: String(a.acao_imediata ?? "").slice(0, 280),
      canal: (["whatsapp", "ligacao", "email", "visita"] as const).includes(a.canal as any) ? a.canal : "whatsapp",
      prazo_dias: Math.max(1, Math.min(14, Number(a.prazo_dias ?? 3))),
    }));

    return {
      resumo: String(parsed.resumo ?? "").slice(0, 400),
      acoes,
      generated_at: new Date().toISOString(),
    };
  });
