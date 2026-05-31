import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgIn = z.object({ organization_id: z.string().uuid() });

const kindEnum = z.enum(["gmail", "outlook", "google_calendar", "whatsapp"]);

/** Lista todas as conexões da organização + última execução de sync por conexão. */
export const listConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgIn.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("integration_connections")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    const lastByConn: Record<string, any> = {};
    if (ids.length) {
      const { data: logs } = await supabase
        .from("integration_sync_log")
        .select("*")
        .in("connection_id", ids)
        .order("started_at", { ascending: false })
        .limit(50);
      for (const l of logs ?? []) {
        if (!lastByConn[(l as any).connection_id]) lastByConn[(l as any).connection_id] = l;
      }
    }
    return { connections: rows ?? [], lastSyncByConn: lastByConn };
  });

const connectIn = orgIn.extend({
  kind: kindEnum,
  account_label: z.string().min(1).max(120),
  config: z.record(z.string(), z.any()).optional(),
});

/**
 * Cria/atualiza uma conexão. Os tokens OAuth reais virão quando o usuário ativar
 * cada provedor com credenciais; por ora gravamos status=active e config opaco.
 */
export const upsertConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => connectIn.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      organization_id: data.organization_id,
      kind: data.kind,
      account_label: data.account_label,
      status: "active" as const,
      config: data.config ?? {},
      created_by: userId,
    };
    const { data: out, error } = await supabase
      .from("integration_connections")
      .upsert(row, { onConflict: "organization_id,kind,account_label" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { connection: out };
  });

const idIn = z.object({ id: z.string().uuid() });

export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idIn.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("integration_connections")
      .update({ status: "disconnected" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idIn.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("integration_connections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Dispara um sync manual: cria um run log, processa um lote de mock (ou hook real
 * configurado) e cria atividades vinculadas a contatos por email/telefone.
 *
 * Como ainda não há OAuth real configurado, esta função apenas registra o run.
 * Quando o usuário plugar credenciais, basta trocar a parte "fetchItems" por chamadas
 * reais ao provedor.
 */
export const triggerSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idIn.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: conn, error: ce } = await supabase
      .from("integration_connections")
      .select("*")
      .eq("id", data.id)
      .single();
    if (ce || !conn) throw new Error(ce?.message ?? "Conexão não encontrada");

    const { data: run, error: re } = await supabase
      .from("integration_sync_log")
      .insert({
        organization_id: (conn as any).organization_id,
        connection_id: (conn as any).id,
        kind: (conn as any).kind,
        status: "running",
      })
      .select()
      .single();
    if (re) throw new Error(re.message);

    // Placeholder: sem provider OAuth real ainda. Marca como sucesso vazio.
    const { error: ue } = await supabase
      .from("integration_sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        items_processed: 0,
        details: { note: "Aguardando credenciais OAuth do provedor." },
      })
      .eq("id", (run as any).id);
    if (ue) throw new Error(ue.message);

    await supabase
      .from("integration_connections")
      .update({ last_sync_at: new Date().toISOString(), status: "active", last_error: null })
      .eq("id", (conn as any).id);

    return { ok: true, run_id: (run as any).id };
  });
