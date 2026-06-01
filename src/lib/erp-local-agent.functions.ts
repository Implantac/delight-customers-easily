/**
 * Agente Local — pareamento de binário desktop para tunelar ERPs on-premise
 * (Firebird, SQL Server local, etc.). O binário em si é um projeto separado;
 * aqui ficam as funções de gerenciamento (pareamento, listagem, revogação).
 */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

function generatePairingCode(): string {
  // 8 grupos de 4 chars alfanuméricos legíveis
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += chars[bytes[i] % chars.length];
    if (i === 3 || i === 7 || i === 11) out += '-';
  }
  return out;
}

export const listLocalAgents = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organizationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('erp_local_agents')
      .select('id, name, pairing_code, status, last_seen_at, version, os, created_at')
      .eq('organization_id', data.organizationId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return { agents: rows ?? [] };
  });

export const createLocalAgent = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ organizationId: z.string().uuid(), name: z.string().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const code = generatePairingCode();
    const tokenHash = createHash('sha256').update(code).digest('hex');
    const { data: row, error } = await context.supabase
      .from('erp_local_agents')
      .insert({
        organization_id: data.organizationId,
        name: data.name,
        pairing_code: code,
        agent_token_hash: tokenHash,
        status: 'pending',
        created_by: context.userId,
      })
      .select('id, name, pairing_code, status, created_at')
      .single();
    if (error) throw new Error(error.message);
    return { agent: row };
  });

export const revokeLocalAgent = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ organizationId: z.string().uuid(), agentId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('erp_local_agents')
      .update({ status: 'revoked' })
      .eq('organization_id', data.organizationId)
      .eq('id', data.agentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
