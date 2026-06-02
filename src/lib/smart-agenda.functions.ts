import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI, safeJSON } from "@/lib/ai-gateway.server";

const input = z.object({
  organization_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["day", "week"]).default("day"),
  persist: z.boolean().default(false),
});

const DAY = 86400000;

type Suggestion = {
  company_id?: string | null;
  company_name: string;
  action: "visita" | "ligacao" | "whatsapp" | "email";
  reason: string;
  priority: number;
  suggested_time?: string | null;
};

/**
 * Gera uma agenda comercial inteligente para o usuário logado, priorizando
 * carteira por: churn risk, sem compra há mais tempo, alto ticket médio,
 * última visita antiga.
 */
export const generateSmartAgenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = data.organization_id;
    const now = Date.now();

    const [companiesRes, churnRes, activitiesRes] = await Promise.all([
      supabase
        .from("companies")
        .select("id, name, city, state, industry, last_purchase_at")
        .eq("organization_id", org)
        .limit(120),
      supabase
        .from("ai_churn_predictions")
        .select("company_id, risk_score, reasons")
        .eq("organization_id", org)
        .gte("risk_score", 0.4)
        .order("risk_score", { ascending: false })
        .limit(40),
      supabase
        .from("activities")
        .select("company_id:contact_id, created_at, type")
        .eq("organization_id", org)
        .eq("user_id", userId)
        .gte("created_at", new Date(now - 60 * DAY).toISOString())
        .limit(200),
    ]);

    const companies = (companiesRes.data ?? []) as any[];
    const churn = (churnRes.data ?? []) as any[];
    const acts = (activitiesRes.data ?? []) as any[];
    const churnMap = new Map(churn.map((c) => [c.company_id, c]));
    const lastTouch = new Map<string, number>();
    for (const a of acts) {
      const id = a.company_id;
      const t = new Date(a.created_at).getTime();
      if (id && (!lastTouch.has(id) || lastTouch.get(id)! < t)) lastTouch.set(id, t);
    }

    const ranked = companies
      .map((c) => {
        const risk = (churnMap.get(c.id) as any)?.risk_score ?? 0;
        const lastPurchase = c.last_purchase_at ? new Date(c.last_purchase_at).getTime() : 0;
        const daysNoBuy = lastPurchase ? Math.floor((now - lastPurchase) / DAY) : 999;
        const lastT = lastTouch.get(c.id) ?? 0;
        const daysNoTouch = lastT ? Math.floor((now - lastT) / DAY) : 999;
        const score =
          risk * 100 +
          Math.min(60, daysNoBuy * 0.4) +
          Math.min(40, daysNoTouch * 0.5);
        return { c, risk, daysNoBuy, daysNoTouch, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, data.mode === "day" ? 12 : 30);

    const summary = ranked.map((r) => ({
      id: r.c.id,
      name: r.c.name,
      city: r.c.city,
      state: r.c.state,
      industry: r.c.industry,
      risk_score: Math.round(r.risk * 100) / 100,
      days_no_buy: r.daysNoBuy >= 999 ? null : r.daysNoBuy,
      days_no_touch: r.daysNoTouch >= 999 ? null : r.daysNoTouch,
    }));

    const ai = await callLovableAI(
      [
        {
          role: "system",
          content: `Você é um coach de vendas que monta a agenda comercial do representante para o dia ${data.date}.
Receba a lista priorizada de clientes e devolva EXCLUSIVAMENTE JSON com schema:
{"suggestions":[{"company_id":"uuid","company_name":"string","action":"visita|ligacao|whatsapp|email","reason":"até 140 chars","priority":1-100,"suggested_time":"HH:MM"}]}
Máximo 8 itens para "day", 20 para "week". Priorize alto risco + sem compra há muito tempo.
Distribua horários comerciais (09:00-18:00).`,
        },
        { role: "user", content: JSON.stringify({ mode: data.mode, candidates: summary }) },
      ],
      { jsonMode: true, model: "google/gemini-2.5-flash" },
    );

    const parsed = safeJSON<{ suggestions: Suggestion[] }>(ai.content) ?? { suggestions: [] };
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 20) : [];

    let persisted = 0;
    if (data.persist && suggestions.length) {
      const rows = suggestions.map((s) => {
        const dueDate = s.suggested_time
          ? new Date(`${data.date}T${s.suggested_time}:00`).toISOString()
          : new Date(`${data.date}T09:00:00`).toISOString();
        return {
          organization_id: org,
          user_id: userId,
          type:
            s.action === "visita"
              ? "meeting"
              : s.action === "ligacao"
                ? "call"
                : s.action === "whatsapp"
                  ? "message"
                  : "email",
          title: `[IA] ${s.action.toUpperCase()} ${s.company_name}`,
          description: s.reason,
          due_date: dueDate,
        };
      });
      const { error } = await (supabase as any).from("activities").insert(rows);
      if (!error) persisted = rows.length;
    }

    return { suggestions, persisted, ranked_count: ranked.length };
  });
