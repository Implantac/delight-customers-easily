import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { retrieveSkills, type KnowledgeHit } from "@/lib/rag.functions";

const input = z.object({
  organization_id: z.string().uuid(),
  question: z.string().min(2).max(2000),
});

const DAY = 86400000;


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
  if (res.status === 402) throw new Error("Créditos de IA insuficientes. Adicione créditos no workspace.");
  if (!res.ok) throw new Error(`IA falhou: ${res.status}`);
  const j = await res.json();
  return (j?.choices?.[0]?.message?.content ?? "").toString();
}

/**
 * Copiloto Comercial: monta um snapshot determinístico do CRM e pede
 * para a IA responder em PT-BR usando apenas esses dados.
 */
export const copilotAsk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();

    const [deals, acts, contacts, companies, skills] = await Promise.all([
      supabase.from("deals")
        .select("id, title, value, stage, expected_close, updated_at, user_id, contact_id, contacts(name), companies(name)")
        .eq("organization_id", org).limit(500),
      supabase.from("activities")
        .select("title, type, due_date, completed, contact_id, user_id, created_at")
        .eq("organization_id", org).gte("created_at", new Date(now - 180 * DAY).toISOString()).limit(500),
      supabase.from("contacts").select("id, name, email, phone, position, created_at, company_id, companies(name)")
        .eq("organization_id", org).limit(500),
      supabase.from("companies").select("id, name, industry, size").eq("organization_id", org).limit(200),
      retrieveSkills(data.question, 5).catch((): KnowledgeHit[] => []),
    ]);


    const dealsArr = deals.data ?? [];
    const actsArr = acts.data ?? [];
    const contactsArr = contacts.data ?? [];
    const companiesArr = companies.data ?? [];

    const open = dealsArr.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const won = dealsArr.filter((d) => d.stage === "won");
    const lost = dealsArr.filter((d) => d.stage === "lost");
    const pipelineValue = open.reduce((s, d) => s + Number(d.value), 0);
    const wonValue = won.reduce((s, d) => s + Number(d.value), 0);

    // last touch per contact
    const lastByContact = new Map<string, number>();
    for (const a of actsArr) {
      if (!a.contact_id) continue;
      const t = new Date(a.due_date ?? a.created_at).getTime();
      const p = lastByContact.get(a.contact_id) ?? 0;
      if (t > p) lastByContact.set(a.contact_id, t);
    }

    const stale = open
      .map((d) => ({ title: d.title, value: Number(d.value), stage: d.stage, stale_days: Math.floor((now - new Date(d.updated_at).getTime()) / DAY), contact: (d.contacts as any)?.name, company: (d.companies as any)?.name }))
      .filter((d) => d.stale_days >= 14)
      .sort((a, b) => b.stale_days - a.stale_days)
      .slice(0, 15);

    const silent = contactsArr
      .map((c) => ({ name: c.name, company: (c.companies as any)?.name, days_silent: Math.floor((now - (lastByContact.get(c.id) ?? new Date(c.created_at).getTime())) / DAY) }))
      .filter((c) => c.days_silent >= 60)
      .sort((a, b) => b.days_silent - a.days_silent)
      .slice(0, 15);

    const overdue = actsArr
      .filter((a) => !a.completed && a.due_date && new Date(a.due_date).getTime() < now)
      .map((a) => ({ title: a.title, type: a.type, due: a.due_date, days_overdue: Math.floor((now - new Date(a.due_date!).getTime()) / DAY) }))
      .sort((a, b) => b.days_overdue - a.days_overdue)
      .slice(0, 15);

    const byStage: Record<string, { count: number; value: number }> = {};
    for (const d of dealsArr) {
      byStage[d.stage] = byStage[d.stage] ?? { count: 0, value: 0 };
      byStage[d.stage].count++;
      byStage[d.stage].value += Number(d.value);
    }

    const snapshot = {
      gerado_em: new Date(now).toISOString(),
      totais: {
        contatos: contactsArr.length,
        empresas: companiesArr.length,
        negocios_abertos: open.length,
        valor_pipeline: pipelineValue,
        ganhos_count: won.length,
        ganhos_valor: wonValue,
        perdidos_count: lost.length,
        atividades_atrasadas: overdue.length,
        clientes_silenciosos: silent.length,
      },
      por_estagio: byStage,
      top_negocios_parados: stale,
      top_clientes_silenciosos: silent,
      tarefas_atrasadas: overdue,
    };

    // Base de conhecimento recuperada via RAG (numerada para citação)
    const skillHits = skills as KnowledgeHit[];
    const sourcesBlock = skillHits.length
      ? skillHits
          .map((s, i) => `[${i + 1}] ${s.title}${s.description ? " — " + s.description : ""}\n${s.content.slice(0, 2000)}`)
          .join("\n\n---\n\n")
      : "(nenhuma skill relevante recuperada)";

    const system = `Você é o Copiloto Comercial deste CRM, atuando como um Diretor Comercial Virtual.
Responda em português do Brasil, de forma direta, executiva e acionável.
Use APENAS os dados do snapshot fornecido — nunca invente clientes, valores ou números.
Quando recomendar ação, seja específico: cite o nome do cliente/negócio e a razão.
Formate em markdown com listas curtas. Máximo 6 itens por lista. Use negrito para destaque.
Se a pergunta não puder ser respondida com os dados, diga isso claramente.
Valores monetários sempre em BRL formatado (R$).

CITAÇÃO DE FONTES (OBRIGATÓRIO):
Você recebe uma BASE DE CONHECIMENTO numerada [1], [2], [3]... com skills de metodologia CRM.
Sempre que apoiar uma recomendação em uma dessas skills, insira a citação inline no formato [n]
imediatamente após a frase relevante — ex.: "Priorize deals parados há 14+ dias [2]."
Você pode citar múltiplas skills numa mesma frase: [1][3]. Nunca invente números de citação
que não estejam na base fornecida. Se a resposta vier apenas dos dados do CRM (sem apoio de skill),
não force citações.

AO FINAL da sua resposta, SEMPRE inclua um bloco JSON delimitado por <<<ACTIONS>>> e <<<END>>>
com até 3 ações sugeridas que o usuário pode executar imediatamente, neste formato:
<<<ACTIONS>>>
[{"label":"Texto curto até 32 chars","href":"/pipeline|/carteira|/whatsapp|/mytasks|/forecast|/retention"}]
<<<END>>>
Se não houver ação clara, devolva um array vazio.`;

    const user = `PERGUNTA DO USUÁRIO:
${data.question}

BASE DE CONHECIMENTO (skills recuperadas por similaridade semântica):
${sourcesBlock}

SNAPSHOT DO CRM (JSON):
${JSON.stringify(snapshot)}`;

    const raw = await callLovableAI(system, user);
    // Extrai bloco de ações
    let actions: Array<{ label: string; href: string }> = [];
    let answer = raw;
    const m = raw.match(/<<<ACTIONS>>>([\s\S]*?)<<<END>>>/);
    if (m) {
      answer = raw.replace(m[0], "").trim();
      try {
        const parsed = JSON.parse(m[1].trim());
        if (Array.isArray(parsed)) {
          actions = parsed
            .filter((x) => x && typeof x.label === "string" && typeof x.href === "string")
            .slice(0, 3)
            .map((x) => ({ label: String(x.label).slice(0, 32), href: String(x.href).slice(0, 200) }));
        }
      } catch {
        /* noop */
      }
    }

    // Só devolve como "fontes" as skills que foram efetivamente citadas na resposta
    const citedNums = new Set<number>();
    for (const match of answer.matchAll(/\[(\d{1,2})\]/g)) {
      const n = parseInt(match[1], 10);
      if (n >= 1 && n <= skillHits.length) citedNums.add(n);
    }
    const sources = skillHits
      .map((s, i) => ({ n: i + 1, slug: s.slug, title: s.title, description: s.description, similarity: s.similarity }))
      .filter((s) => citedNums.has(s.n));

    return { answer, actions, sources };
  });

  });
