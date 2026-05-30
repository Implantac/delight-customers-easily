import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });
const DAY = 86400000;

async function callLovableAI(systemPrompt: string, userPrompt: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (res.status === 429) throw new Error("Limite de uso de IA atingido. Tente novamente em instantes.");
  if (res.status === 402) throw new Error("Créditos de IA insuficientes.");
  if (!res.ok) throw new Error(`IA falhou: ${res.status}`);
  const j = await res.json();
  return (j?.choices?.[0]?.message?.content ?? "").toString();
}

const SYSTEM = `Você é um Comitê Executivo Comercial com 4 papéis: Diretor Comercial (follow-up), VP de Crescimento (oportunidades), Head de CS (riscos) e Gerente de Vendas (representantes).

Analise os dados do CRM fornecidos e gere recomendações ACIONÁVEIS, específicas e priorizadas.

Responda EXCLUSIVAMENTE em JSON com este schema:
{
  "recommendations": [
    {
      "agent": "followup" | "opportunities" | "risks" | "reps",
      "surface": "dashboard" | "pipeline" | "carteira" | "marketing",
      "title": "string curta (até 80 chars) imperativa",
      "reason": "string explicativa (até 180 chars) com números reais dos dados",
      "action_label": "string curta de CTA (até 24 chars)",
      "action_href": "/pipeline | /carteira | /marketing | /command | /deals/{id}",
      "priority": 50-99,
      "impact_brl": número opcional
    }
  ]
}

Limite: máximo 8 recomendações totais, as MAIS importantes. Sem texto fora do JSON.`;

/**
 * IA Comercial real — chama Gemini 2.5 Pro com os dados do CRM e injeta
 * as recomendações geradas na fila unificada (source='ai'), substituindo
 * as recomendações IA antigas. Heurísticas (source='heuristic') continuam
 * intocadas em paralelo.
 */
export const generateAIRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();

    const [dealsRes, invRes, compRes, leadsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, title, value, stage, expected_close, updated_at, company_id")
        .eq("organization_id", org)
        .not("stage", "in", "(won,lost)")
        .order("value", { ascending: false })
        .limit(40),
      supabase
        .from("invoices")
        .select("id, company_id, amount, status, due_date")
        .eq("organization_id", org)
        .neq("status", "paid")
        .limit(40),
      supabase.from("companies").select("id, name, industry").eq("organization_id", org).limit(100),
      supabase
        .from("marketing_leads")
        .select("id, name, channel, status, created_at")
        .eq("organization_id", org)
        .gte("created_at", new Date(now - 30 * DAY).toISOString())
        .limit(40),
    ]);

    const deals = dealsRes.data ?? [];
    const invoices = (invRes.data ?? []) as any[];
    const companies = compRes.data ?? [];
    const leads = (leadsRes.data ?? []) as any[];
    const compName = new Map(companies.map((c: any) => [c.id, c.name]));

    const summary = {
      now: new Date().toISOString(),
      open_deals: deals.map((d: any) => ({
        id: d.id,
        title: d.title,
        company: compName.get(d.company_id) ?? null,
        value: Number(d.value ?? 0),
        stage: d.stage,
        expected_close: d.expected_close,
        days_since_update: Math.floor((now - new Date(d.updated_at).getTime()) / DAY),
      })),
      overdue_invoices: invoices
        .filter((i) => i.due_date && new Date(i.due_date).getTime() < now)
        .map((i) => ({
          company: compName.get(i.company_id) ?? null,
          amount: Number(i.amount ?? 0),
          days_overdue: Math.floor((now - new Date(i.due_date).getTime()) / DAY),
        })),
      recent_leads: leads.map((l) => ({
        name: l.name,
        channel: l.channel,
        status: l.status,
        days_old: Math.floor((now - new Date(l.created_at).getTime()) / DAY),
      })),
    };

    const raw = await callLovableAI(SYSTEM, JSON.stringify(summary));
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON from text
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { recommendations: [] };
    }
    const recs: any[] = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];

    // Wipe previous AI recs (open)
    await supabase
      .from("recommendations")
      .delete()
      .eq("organization_id", org)
      .eq("source", "ai")
      .eq("status", "open");

    if (recs.length) {
      const rows = recs.slice(0, 12).map((r) => ({
        organization_id: org,
        surface: typeof r.surface === "string" ? r.surface : "dashboard",
        title: String(r.title ?? "").slice(0, 200),
        reason: String(r.reason ?? "").slice(0, 500),
        action_label: String(r.action_label ?? "Executar").slice(0, 32),
        action_href: typeof r.action_href === "string" ? r.action_href.slice(0, 200) : null,
        priority: Math.max(50, Math.min(99, Number(r.priority ?? 70))),
        impact_brl: r.impact_brl != null ? Number(r.impact_brl) : null,
        source: "ai",
        expires_at: new Date(now + 24 * 3600 * 1000).toISOString(),
      }));
      const { error } = await supabase.from("recommendations").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { generated: recs.length, sample: recs.slice(0, 3) };
  });
