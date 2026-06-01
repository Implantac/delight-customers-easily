/**
 * Server functions para credenciais ERP criptografadas + estratégia de conflito.
 * Wrapper sobre erp_integrations que prefere `credentials_enc` (AES-256-GCM).
 * Mantém compat com colunas legadas app_key/app_secret durante migração gradual.
 */
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { encryptCredentials, decryptCredentials } from './erp-crypto.server';

const CONFLICT_STRATEGIES = ['erp_wins', 'crm_wins', 'last_write_wins', 'manual'] as const;

// Salva (ou cria) integração com credenciais cifradas
export const saveErpCredentials = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        provider: z.string().min(1).max(50),
        credentials: z.record(z.string(), z.unknown()), // { app_key, app_secret, base_url, ... }
        conflictStrategy: z.enum(CONFLICT_STRATEGIES).default('erp_wins'),
        isActive: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const enc = encryptCredentials(data.credentials);

    // app_key/app_secret são NOT NULL — gravamos placeholder seguro
    const appKey = String(data.credentials.app_key ?? 'enc');
    const appSecret = 'enc::see_credentials_enc';

    const { data: row, error } = await (supabase as any)
      .from('erp_integrations')
      .upsert(
        {
          organization_id: data.organizationId,
          provider: data.provider,
          app_key: appKey,
          app_secret: appSecret,
          credentials_enc: enc,
          credentials_version: 1,
          conflict_strategy: data.conflictStrategy,
          is_active: data.isActive,
          last_error: null,
        },
        { onConflict: 'organization_id,provider' },
      )
      .select('id, provider, conflict_strategy, is_active, last_sync_at')
      .single();
    if (error) throw new Error(error.message);
    return { integration: row };
  });

// Lê credenciais decifradas (server-only — handler nunca devolve segredos pro client)
export const validateErpCredentials = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ organizationId: z.string().uuid(), provider: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from('erp_integrations')
      .select('credentials_enc, app_key, app_secret')
      .eq('organization_id', data.organizationId)
      .eq('provider', data.provider)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { hasCredentials: false, fields: [] as string[] };

    const creds = row.credentials_enc
      ? decryptCredentials<Record<string, unknown>>(row.credentials_enc)
      : { app_key: row.app_key, app_secret: row.app_secret };

    // devolve apenas a LISTA de chaves presentes (não os valores)
    return { hasCredentials: true, fields: Object.keys(creds) };
  });

export const updateConflictStrategy = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        organizationId: z.string().uuid(),
        integrationId: z.string().uuid(),
        strategy: z.enum(CONFLICT_STRATEGIES),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('erp_integrations')
      .update({ conflict_strategy: data.strategy })
      .eq('organization_id', data.organizationId)
      .eq('id', data.integrationId);
    if (error) throw new Error(error.message);
    return { ok: true, strategy: data.strategy };
  });
