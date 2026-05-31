import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI, safeJSON, type ChatMessage } from "./ai-gateway.server";

const SYSTEM_THREAD = `Você é o Copiloto Comercial do CRM. Responda em PT-BR, executivo, direto, em markdown curto.
Use bullets curtos e negrito para destaque. Valores em R$ formatado.
Se não tiver dados suficientes, peça especificação.`;

/* ------------------------- THREADS ------------------------- */

export const listThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("ai_copilot_threads")
      .select("id,title,context_type,context_id,updated_at,created_at")
      .eq("organization_id", data.organization_id)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return { threads: rows ?? [] };
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      title: z.string().min(1).max(120).optional(),
      context_type: z.string().max(40).optional(),
      context_id: z.string().uuid().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("ai_copilot_threads")
      .insert({
        organization_id: data.organization_id,
        user_id: userId,
        title: data.title ?? "Nova conversa",
        context_type: data.context_type ?? null,
        context_id: data.context_id ?? null,
      })
      .select("id,title,created_at")
      .single();
    if (error) throw error;
    return { thread: row };
  });

export const getThreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ thread_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("ai_copilot_messages")
      .select("id,role,content,created_at")
      .eq("thread_id", data.thread_id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    return { messages: rows ?? [] };
  });

export const postThreadMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      thread_id: z.string().uuid(),
      organization_id: z.string().uuid(),
      content: z.string().min(1).max(4000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1) carrega histórico (até 20 últimas)
    const { data: hist } = await supabase
      .from("ai_copilot_messages")
      .select("role,content")
      .eq("thread_id", data.thread_id)
      .order("created_at", { ascending: true })
      .limit(20);

    // 2) grava mensagem do usuário
    await supabase.from("ai_copilot_messages").insert({
      thread_id: data.thread_id,
      organization_id: data.organization_id,
      role: "user",
      content: data.content,
    });

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_THREAD },
      ...((hist ?? []).map((m) => ({ role: m.role as ChatMessage["role"], content: m.content }))),
      { role: "user", content: data.content },
    ];

    const ai = await callLovableAI(messages, { model: "google/gemini-2.5-flash", temperature: 0.5 });

    await supabase.from("ai_copilot_messages").insert({
      thread_id: data.thread_id,
      organization_id: data.organization_id,
      role: "assistant",
      content: ai.content,
      tokens_in: ai.tokensIn ?? null,
      tokens_out: ai.tokensOut ?? null,
      model: ai.model,
    });

    await supabase
      .from("ai_copilot_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.thread_id);

    return { reply: ai.content };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ thread_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("ai_copilot_threads").delete().eq("id", data.thread_id);
    if (error) throw error;
    return { ok: true };
  });

/* ------------------------- DEAL INSIGHTS ------------------------- */

const InsightShape = z.object({
  summary: z.string().max(800),
  risk_level: z.enum(["low", "medium", "high"]),
  risk_reason: z.string().max(400),
  win_probability: z.number().min(0).max(100),
  next_actions: z.array(z.object({
    title: z.string().max(120),
    why: z.string().max(240),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
  })).max(5),
});

export const getDealInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ deal_id: z.string().uuid(), force: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    if (!data.force) {
      const { data: cached } = await supabase
        .from("ai_deal_insights")
        .select("*")
        .eq("deal_id", data.deal_id)
        .maybeSingle();
      if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
        return { insight: cached, cached: true };
      }
    }

    const { data: deal, error } = await supabase
      .from("deals")
      .select("id,organization_id,title,stage,value,expected_close,created_at,updated_at,probability,owner_id,contact_id,company_id,contacts(name,email),companies(name,industry)")
      .eq("id", data.deal_id)
      .single();
    if (error || !deal) throw error ?? new Error("Deal não encontrado");

    const { data: acts } = await supabase
      .from("activities")
      .select("title,type,due_date,completed,created_at")
      .eq("deal_id", data.deal_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const snapshot = {
      negocio: {
        titulo: deal.title,
        estagio: deal.stage,
        valor: Number(deal.value),
        fechamento_previsto: deal.expected_close,
        criado_em: deal.created_at,
        atualizado_em: deal.updated_at,
        probabilidade: deal.probability,
      },
      contato: (deal as any).contacts ?? null,
      empresa: (deal as any).companies ?? null,
      atividades: (acts ?? []).map((a) => ({
        titulo: a.title, tipo: a.type, vence: a.due_date, concluida: a.completed, criada: a.created_at,
      })),
    };

    const system = `Você é o Diretor Comercial Virtual. Analise UM negócio e devolva JSON estrito no schema:
{
  "summary": "resumo executivo em PT-BR, até 3 frases",
  "risk_level": "low" | "medium" | "high",
  "risk_reason": "motivo curto do risco",
  "win_probability": número 0-100,
  "next_actions": [{"title":"ação curta","why":"motivo","priority":"low|medium|high"}, ...] (até 5)
}
Use APENAS os dados fornecidos. Não invente.`;

    const ai = await callLovableAI(
      [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(snapshot) },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.2, jsonMode: true },
    );

    const parsed = InsightShape.safeParse(safeJSON(ai.content));
    if (!parsed.success) throw new Error("Resposta inválida da IA");

    const payload = parsed.data;
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: upserted, error: upErr } = await supabase
      .from("ai_deal_insights")
      .upsert({
        organization_id: deal.organization_id,
        deal_id: deal.id,
        summary: payload.summary,
        risk_level: payload.risk_level,
        risk_reason: payload.risk_reason,
        win_probability: payload.win_probability,
        next_actions: payload.next_actions,
        model: ai.model,
        generated_at: new Date().toISOString(),
        expires_at: expires,
      }, { onConflict: "deal_id" })
      .select("*")
      .single();
    if (upErr) throw upErr;

    return { insight: upserted, cached: false };
  });

/* ------------------------- EMAIL DRAFT ------------------------- */

export const draftEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      deal_id: z.string().uuid().optional(),
      contact_id: z.string().uuid().optional(),
      purpose: z.string().min(2).max(200),
      tone: z.enum(["formal", "casual", "consultivo", "urgente"]).default("consultivo"),
      language: z.enum(["pt-BR", "en"]).default("pt-BR"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let dealCtx: any = null;
    if (data.deal_id) {
      const { data: d } = await supabase
        .from("deals")
        .select("title,stage,value,expected_close,contacts(name,email),companies(name,industry)")
        .eq("id", data.deal_id)
        .maybeSingle();
      dealCtx = d ?? null;
    }

    const system = `Você redige emails comerciais ${data.language === "en" ? "em INGLÊS" : "em PORTUGUÊS BRASILEIRO"} no tom ${data.tone}.
Devolva JSON estrito: {"subject":"...","body":"..."}.
Body em texto puro com quebras de linha (sem markdown). Máximo 180 palavras. Não invente fatos. Use [Seu Nome] como assinatura.`;

    const user = `Objetivo: ${data.purpose}
Contexto do negócio: ${JSON.stringify(dealCtx ?? {})}`;

    const ai = await callLovableAI(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model: "google/gemini-2.5-flash", temperature: 0.6, jsonMode: true },
    );

    const parsed = z.object({
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(5000),
    }).safeParse(safeJSON(ai.content));
    if (!parsed.success) throw new Error("Resposta inválida da IA");

    const { data: row, error } = await supabase
      .from("ai_email_drafts")
      .insert({
        organization_id: data.organization_id,
        user_id: userId,
        deal_id: data.deal_id ?? null,
        contact_id: data.contact_id ?? null,
        purpose: data.purpose,
        tone: data.tone,
        subject: parsed.data.subject,
        body: parsed.data.body,
        model: ai.model,
      })
      .select("*")
      .single();
    if (error) throw error;

    return { draft: row };
  });
