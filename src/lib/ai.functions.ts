import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  action: z.enum(["summarize_contact", "score_deal", "next_action"]),
  contact_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
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

export const aiAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    if (data.action === "summarize_contact" || data.action === "next_action") {
      if (!data.contact_id) throw new Error("contact_id obrigatório");
      const { data: c } = await supabase
        .from("contacts")
        .select("name, email, phone, position, notes, companies(name, industry)")
        .eq("id", data.contact_id)
        .maybeSingle();
      if (!c) throw new Error("Contato não encontrado");

      const { data: acts } = await supabase
        .from("activities")
        .select("title, type, due_date, completed, description")
        .eq("contact_id", data.contact_id)
        .order("due_date", { ascending: false, nullsFirst: false })
        .limit(15);

      const { data: deals } = await supabase
        .from("deals").select("title, stage, value")
        .eq("contact_id", data.contact_id);

      const profile = `Contato: ${c.name}${c.position ? ` (${c.position})` : ""}
Empresa: ${(c.companies as any)?.name ?? "—"}${(c.companies as any)?.industry ? ` · ${(c.companies as any).industry}` : ""}
Email: ${c.email ?? "—"} · Tel: ${c.phone ?? "—"}
Notas: ${c.notes ?? "—"}
Negócios: ${(deals ?? []).map((d) => `${d.title} [${d.stage}] R$${d.value}`).join("; ") || "nenhum"}
Atividades recentes:
${(acts ?? []).map((a) => `- ${a.completed ? "[OK]" : "[ ]"} ${a.type}: ${a.title}${a.description ? ` — ${a.description}` : ""}${a.due_date ? ` (${new Date(a.due_date).toLocaleDateString("pt-BR")})` : ""}`).join("\n") || "nenhuma"}`;

      if (data.action === "summarize_contact") {
        const out = await callLovableAI(
          "Você é um analista comercial. Resuma em português, em no máximo 4 bullets curtos, o estado deste relacionamento comercial.",
          profile,
        );
        return { result: out };
      }
      const out = await callLovableAI(
        "Você é um coach de vendas. Sugira a PRÓXIMA AÇÃO ideal para avançar este relacionamento. Responda em português com: 1 frase de diagnóstico + 1 ação concreta (canal, mensagem-chave, prazo sugerido).",
        profile,
      );
      return { result: out };
    }

    if (data.action === "score_deal") {
      if (!data.deal_id) throw new Error("deal_id obrigatório");
      const { data: d } = await supabase
        .from("deals")
        .select("title, value, stage, expected_close, notes, contacts(name, position), companies(name, industry)")
        .eq("id", data.deal_id)
        .maybeSingle();
      if (!d) throw new Error("Negócio não encontrado");
      const { data: acts } = await supabase
        .from("activities").select("title, type, completed, due_date")
        .eq("deal_id", data.deal_id).limit(20);

      const ctx = `Negócio: ${d.title}
Valor: R$${d.value} · Estágio: ${d.stage} · Fechamento previsto: ${d.expected_close ?? "—"}
Contato: ${(d.contacts as any)?.name ?? "—"} (${(d.contacts as any)?.position ?? "—"})
Empresa: ${(d.companies as any)?.name ?? "—"} · ${(d.companies as any)?.industry ?? "—"}
Notas: ${d.notes ?? "—"}
Atividades: ${(acts ?? []).length} total, ${(acts ?? []).filter((a) => a.completed).length} concluídas`;

      const out = await callLovableAI(
        "Você é um analista de pipeline. Dê um score de 0 a 100 de probabilidade de fechamento e justifique em 2-3 bullets. Formato: 'Score: NN/100' + bullets.",
        ctx,
      );
      return { result: out };
    }

    throw new Error("Ação inválida");
  });
