import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const listAgentTokens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("erp_agent_tokens")
      .select("id, name, last_used_at, revoked_at, created_at")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tokens: rows ?? [] };
  });

export const createAgentToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      organization_id: z.string().uuid(),
      name: z.string().min(1).max(100),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const raw = `era_${randomBytes(24).toString("hex")}`;
    const { data: row, error } = await context.supabase
      .from("erp_agent_tokens")
      .insert({
        organization_id: data.organization_id,
        name: data.name,
        token_hash: sha256(raw),
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, token: raw };
  });

export const revokeAgentToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("erp_agent_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
