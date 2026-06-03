import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI, safeJSON } from "@/lib/ai-gateway.server";

const Input = z.object({
  organization_id: z.string().uuid(),
  days: z.number().int().min(30).max(720).default(180),
});

export type WinLossInsight = {
  titulo: string;
  categoria: "produto" | "preco" | "processo" | "concorrencia" | "time" | "outro";
  severidade: "alta" | "media" | "baixa";
  evidencia: string;
  recomendacao: string;
  impacto_estimado: string;
};

export type WinLossPlan = {
  resumo: string;
  maior_alavanca: string;
  insights: WinLossInsight[];
  proximas_acoes: string[];
  generated_at: string;
};

const DAY = 86400000;

export const getWinLossPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }): Promise<WinLossPlan> => {
    const { supabase } = context;
    const org = data.organization_id;
    const since = new Date(Date.now() - data.days * DAY).toISOString();

    const [dealsRes, profilesRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, title, stage, value, owner_id, outcome_reason, closed_at, created_at")
        .eq("organization_id", org)
        .in("stage", ["won", "lost"])
        .gte("closed_at", since),
      supabase.from("profiles").select("id, full_name").eq("organization_id", org),
    ]);
    const deals = dealsRes.data ?? [];
    const profiles = profilesRes.data ?? [];
    const nameById = new Map(profiles.map((p: any) => [p.id, p.full_name]));

    const won = deals.filter((d: any) => d.stage === "won");
    const lost = deals.filter((d: any) => d.stage === "lost");
    const wonValue = won.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
    const lostValue = lost.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
    const winRate = deals.length ? won.length / deals.length : 0;

    const reasonAgg = new Map<string, { outcome: string; count: number; value: number }>();
    for (const d of deals as any[]) {
      const key = `${d.stage}::${(d.outcome_reason || "Sem motivo").trim()}`;
      const cur = reasonAgg.get(key) ?? { outcome: d.stage, count: 0, value: 0 };
      cur.count += 1;
      cur.value += Number(d.value || 0);
      reasonAgg.set(key, cur);
    }
    const reasons = Array.from(reasonAgg.entries())
      .map(([k, v]) => {
        const [outcome, reason] = k.split("::");
        return { outcome, reason, count: v.count, value: v.value };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    const userAgg = new Map<string, { won: number; lost: number; wonValue: number; lostValue: number }>();
    for (const d of deals as any[]) {
      if (!d.owner_id) continue;
      const cur = userAgg.get(d.owner_id) ?? { won: 0, lost: 0, wonValue: 0, lostValue: 0 };
      if (d.stage === "won") { cur.won += 1; cur.wonValue += Number(d.value || 0); }
      else { cur.lost += 1; cur.lostValue += Number(d.value || 0); }
      userAgg.set(d.owner_id, cur);
    }
    const userPerf = Array.from(userAgg.entries()).map(([id, v]) => ({
      name: nameById.get(id) ?? "Sem nome",
      won: v.won,
      lost: v.lost,
      win_rate: v.won + v.lost ? v.won / (v.won + v.lost) : 0,
      won_value: v.wonValue,
      lost_value: v.lostValue,
    })).sort((a, b) => b.won_value - a.won_value).slice(0, 10);

    if (deals.length < 3) {
      return {
        resumo: "Volume insuficiente para análise. Feche mais negócios e preencha o motivo de ganho/perda para destravar insights.",
        maior_alavanca: "Registrar motivo em 100% dos deals fechados.",
        insights: [],
        proximas_acoes: ["Preencher outcome_reason em todos os deals já fechados", "Padronizar lista de motivos com o time"],
        generated_at: new Date().toISOString(),
      };
    }

    const sys =
      "Você é um diretor comercial sênior analisando win/loss. Responda APENAS JSON válido em português do Brasil, focado em padrões reais dos dados. Não invente nada.";

    const user = `Dados reais dos últimos ${data.days} dias:
Resumo: winRate=${(winRate * 100).toFixed(1)}%, ganhos=${won.length}/${BRL(wonValue)}, perdidos=${lost.length}/${BRL(lostValue)}.
Motivos agregados (ordenados por valor): ${JSON.stringify(reasons)}
Performance por vendedor: ${JSON.stringify(userPerf)}

Gere análise estratégica. Schema EXATO de saída (JSON):
{
  "resumo": "2-3 frases sobre o padrão geral",
  "maior_alavanca": "1 frase: a oportunidade #1 de receita se resolvida",
  "insights": [
    {
      "titulo": "frase curta",
      "categoria": "produto"|"preco"|"processo"|"concorrencia"|"time"|"outro",
      "severidade": "alta"|"media"|"baixa",
      "evidencia": "número/fato extraído dos dados",
      "recomendacao": "ação concreta no imperativo",
      "impacto_estimado": "estimativa em R$ ou %"
    }
  ],
  "proximas_acoes": ["3 a 5 ações concretas para a semana"]
}`;

    const res = await callLovableAI(
      [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.3, jsonMode: true },
    );

    const parsed = safeJSON<{
      resumo: string;
      maior_alavanca: string;
      insights: WinLossInsight[];
      proximas_acoes: string[];
    }>(res.content);
    if (!parsed || !Array.isArray(parsed.insights)) {
      throw new Error("IA retornou resposta inválida. Tente novamente.");
    }

    const cats = ["produto", "preco", "processo", "concorrencia", "time", "outro"] as const;
    const sev = ["alta", "media", "baixa"] as const;
    const insights: WinLossInsight[] = parsed.insights.slice(0, 8).map((i) => ({
      titulo: String(i.titulo ?? "").slice(0, 160),
      categoria: (cats as readonly string[]).includes(i.categoria as any) ? i.categoria : "outro",
      severidade: (sev as readonly string[]).includes(i.severidade as any) ? i.severidade : "media",
      evidencia: String(i.evidencia ?? "").slice(0, 280),
      recomendacao: String(i.recomendacao ?? "").slice(0, 280),
      impacto_estimado: String(i.impacto_estimado ?? "").slice(0, 120),
    }));

    return {
      resumo: String(parsed.resumo ?? "").slice(0, 500),
      maior_alavanca: String(parsed.maior_alavanca ?? "").slice(0, 280),
      insights,
      proximas_acoes: (parsed.proximas_acoes ?? []).slice(0, 6).map((s) => String(s).slice(0, 200)),
      generated_at: new Date().toISOString(),
    };
  });

function BRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
