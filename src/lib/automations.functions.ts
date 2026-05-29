import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  organization_id: z.string().uuid(),
  event: z.string().min(1).max(64),
  payload: z.record(z.string(), z.any()),
});

/**
 * Avalia uma condição muito simples: cada chave em `conditions` deve casar
 * com o mesmo caminho em `payload`. Suporta apenas igualdade exata.
 * Ex: conditions = { "to_stage": "won" }, payload = { to_stage: "won", ... } → match.
 */
function matches(conditions: Record<string, unknown>, payload: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(conditions ?? {})) {
    if (v === "" || v === null || v === undefined) continue;
    if (payload[k] !== v) return false;
  }
  return true;
}

export const runAutomations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: rules, error } = await supabase
      .from("automations")
      .select("id, trigger_event, conditions, action_type, action_config, run_count")
      .eq("organization_id", data.organization_id)
      .eq("enabled", true)
      .eq("trigger_event", data.event);

    if (error) throw new Error(error.message);
    if (!rules || rules.length === 0) return { matched: 0, executed: 0 };

    let executed = 0;
    for (const rule of rules) {
      const cond = (rule.conditions ?? {}) as Record<string, unknown>;
      if (!matches(cond, data.payload)) continue;

      const cfg = (rule.action_config ?? {}) as Record<string, any>;

      try {
        if (rule.action_type === "create_activity") {
          await supabase.from("activities").insert({
            organization_id: data.organization_id,
            user_id: userId,
            type: (cfg.type as string) ?? "task",
            title: String(cfg.title ?? "Tarefa automática"),
            description: cfg.description ? String(cfg.description) : null,
            contact_id: (data.payload.contact_id as string | undefined) ?? null,
            deal_id: (data.payload.deal_id as string | undefined) ?? null,
            due_date: cfg.due_in_days
              ? new Date(Date.now() + Number(cfg.due_in_days) * 86400000).toISOString()
              : null,
            completed: false,
          });
        } else if (rule.action_type === "create_notification") {
          await supabase.from("notifications").insert({
            organization_id: data.organization_id,
            user_id: userId,
            type: "automation",
            title: String(cfg.title ?? "Automação acionada"),
            body: cfg.body ? String(cfg.body) : `Evento: ${data.event}`,
            link: cfg.link ? String(cfg.link) : null,
          });
        } else {
          continue; // tipo desconhecido
        }

        await supabase
          .from("automations")
          .update({ run_count: (rule.run_count ?? 0) + 1, last_run_at: new Date().toISOString() })
          .eq("id", rule.id);
        executed++;
      } catch (e) {
        console.error("automation execution failed", rule.id, e);
      }
    }

    return { matched: rules.length, executed };
  });
