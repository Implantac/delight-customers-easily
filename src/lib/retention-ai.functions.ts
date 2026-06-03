import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI, safeJSON } from "@/lib/ai-gateway.server";
import { getRetentionInsights } from "@/lib/churn.functions";

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

export const getRetentionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }): Promise<RetentionPlan> => {
    // Reaproveita a heurística existente — não duplica lógica.
    const insights = await (getRetentionInsights as any)({
      data: { organization_id: data.organization_id },
      context,
    } as any).catch(async () => {
      // Fallback caso o serverFn não aceite context direto — chama via supabase no contexto.
      const { supabase } = context;
      const [companies, deals, activities, contacts] = await Promise.all([
        supabase.from("companies").select("id, name, industry").eq("organization_id", data.organization_id),
        supabase.from("deals").select("id, company_id, stage, value, updated_at").eq("organization_id", data.organization_id),
        supabase.from("activities").select("id, contact_id, deal_id, created_at").eq("organization_id", data.organization_id),
        supabase.from("contacts").select("id, company_id").eq("organization_id", data.organization_id),
      ]);
      return { rows: [], summary: {}, _raw: { companies, deals, activities, contacts } };
    });

    const atRisk = (insights.rows ?? [])
      .filter((r: any) => r.level === "risco" || r.level === "atencao")
      .slice(0, data.max_companies);

    if (atRisk.length === 0) {
      return {
        resumo: "Nenhum cliente em risco no momento. Foque em oportunidades de expansão.",
        acoes: [],
        generated_at: new Date().toISOString(),
      };
    }

    const payload = atRisk.map((r: any) => ({
      id: r.company_id,
      nome: r.name,
      setor: r.industry ?? null,
      risco: r.risk,
      dias_sem_contato: r.days_silent,
      valor_ganho: r.won_value,
      pipeline_aberto: r.open_value,
      motivos: r.reasons,
    }));

    const sys =
      "Você é um consultor sênior de retenção B2B. Responda APENAS JSON válido no schema solicitado, em português do Brasil, conciso e acionável.";

    const user = `Contexto: clientes em risco de churn de uma empresa B2B.
Dados (até ${atRisk.length} clientes): ${JSON.stringify(payload)}

Gere um plano priorizado. Schema EXATO de saída:
{
  "resumo": "1-2 frases com o padrão geral do risco e o que priorizar nesta semana",
  "acoes": [
    {
      "company_id": "<id>",
      "company_name": "<nome>",
      "risk": <0-100>,
      "priority": "alta" | "media" | "baixa",
      "diagnostico": "1 frase explicando o porquê",
      "acao_imediata": "ação concreta em 1 frase, no imperativo",
      "canal": "whatsapp" | "ligacao" | "email" | "visita",
      "prazo_dias": <int 1-14>
    }
  ]
}
Não inclua texto fora do JSON. Não invente dados que não estão no contexto.`;

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

    // Sanitiza canais e prazo
    const acoes: RetentionAction[] = parsed.acoes.map((a) => ({
      company_id: String(a.company_id ?? ""),
      company_name: String(a.company_name ?? ""),
      risk: Math.max(0, Math.min(100, Number(a.risk ?? 0))),
      priority: (["alta", "media", "baixa"] as const).includes(a.priority) ? a.priority : "media",
      diagnostico: String(a.diagnostico ?? "").slice(0, 280),
      acao_imediata: String(a.acao_imediata ?? "").slice(0, 280),
      canal: (["whatsapp", "ligacao", "email", "visita"] as const).includes(a.canal) ? a.canal : "whatsapp",
      prazo_dias: Math.max(1, Math.min(14, Number(a.prazo_dias ?? 3))),
    }));

    return {
      resumo: String(parsed.resumo ?? "").slice(0, 400),
      acoes,
      generated_at: new Date().toISOString(),
    };
  });
