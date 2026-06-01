/**
 * Diagnóstico conversacional do ConnectHub via Lovable AI.
 * O usuário descreve o problema em linguagem natural; a IA pergunta de volta,
 * sugere causas prováveis e ações. Persiste o histórico em erp_diagnostic_messages.
 */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const SYSTEM_PROMPT = `Você é um especialista em integrações ERP×CRM que ajuda usuários NÃO TÉCNICOS a diagnosticar problemas de conexão e sincronização.

Regras:
- Fale português claro, sem jargão técnico desnecessário.
- Faça perguntas curtas, uma de cada vez, até entender o problema.
- Quando identificar a causa provável, explique em 1-2 frases e ofereça AÇÕES (até 3) que o usuário pode tentar.
- Nunca peça senhas, tokens ou chaves de API no chat.
- Se o problema for credencial inválida → oriente a reabrir o assistente de conexão.
- Se for ERP fora do ar → sugira verificar status do provedor.
- Se for mapeamento de campos → indique abrir a aba "Mapeamento".
- Se for conflito de dados → indique abrir "Conflitos".`;

export const listDiagnosticMessages = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        integrationId: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from('erp_diagnostic_messages')
      .select('id, role, content, created_at, integration_id')
      .eq('organization_id', data.organizationId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (data.integrationId) q = q.eq('integration_id', data.integrationId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });

export const sendDiagnosticMessage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organizationId: z.string().uuid(),
        integrationId: z.string().uuid().nullable().optional(),
        content: z.string().min(1).max(2000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error('LOVABLE_API_KEY não configurada');

    // 1) Persiste mensagem do usuário
    await supabase.from('erp_diagnostic_messages').insert({
      organization_id: data.organizationId,
      integration_id: data.integrationId ?? null,
      role: 'user',
      content: data.content,
      created_by: userId,
    });

    // 2) Carrega contexto: status da integração + últimos jobs/erros
    let ctxBlock = '';
    if (data.integrationId) {
      const [{ data: integ }, { data: jobs }] = await Promise.all([
        supabase
          .from('erp_integrations')
          .select('provider, connector_type, sync_mode, last_sync_at, last_error, is_active')
          .eq('id', data.integrationId)
          .maybeSingle(),
        supabase
          .from('erp_sync_jobs')
          .select('resource, status, error_message, finished_at')
          .eq('integration_id', data.integrationId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);
      if (integ) {
        ctxBlock = `\n\nCONTEXTO ATUAL DA INTEGRAÇÃO:\n- Provedor: ${integ.provider}\n- Conector: ${integ.connector_type}\n- Modo: ${integ.sync_mode}\n- Ativa: ${integ.is_active}\n- Última sync: ${integ.last_sync_at ?? 'nunca'}\n- Último erro: ${integ.last_error ?? 'nenhum'}\n- Últimos jobs: ${JSON.stringify(jobs ?? [])}`;
      }
    }

    // 3) Histórico curto
    const { data: history } = await supabase
      .from('erp_diagnostic_messages')
      .select('role, content')
      .eq('organization_id', data.organizationId)
      .eq('integration_id', data.integrationId ?? null)
      .order('created_at', { ascending: true })
      .limit(20);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + ctxBlock },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
    ];

    // 4) Chama Lovable AI
    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Lovable AI falhou: ${resp.status} ${text.slice(0, 200)}`);
    }
    const json = (await resp.json()) as any;
    const reply = json?.choices?.[0]?.message?.content ?? 'Não consegui processar agora. Tente novamente.';

    // 5) Persiste resposta
    const { data: assistantMsg } = await supabase
      .from('erp_diagnostic_messages')
      .insert({
        organization_id: data.organizationId,
        integration_id: data.integrationId ?? null,
        role: 'assistant',
        content: reply,
      })
      .select('id, role, content, created_at')
      .single();

    return { reply: assistantMsg };
  });
