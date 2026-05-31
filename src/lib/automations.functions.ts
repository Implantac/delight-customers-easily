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
      if (!matches(cond, data.payload)) {
        await supabase.from("automation_runs").insert({
          organization_id: data.organization_id,
          automation_id: rule.id,
          trigger_event: data.event,
          payload: data.payload,
          status: "skipped",
          duration_ms: 0,
        });
        continue;
      }

      const cfg = (rule.action_config ?? {}) as Record<string, any>;
      const t0 = Date.now();
      let runStatus: "success" | "error" = "success";
      let runErr: string | null = null;

      try {
        if (rule.action_type === "create_activity") {
          await supabase.from("activities").insert({
            organization_id: data.organization_id,
            user_id: userId,
            type: ((cfg.type as "call" | "email" | "meeting" | "note" | "task" | undefined) ?? "task"),
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
        } else if (rule.action_type === "change_deal_stage") {
          const dealId = data.payload.deal_id as string | undefined;
          const toStage = cfg.to_stage as string | undefined;
          if (dealId && toStage) {
            await supabase
              .from("deals")
              .update({ stage: toStage as any, updated_at: new Date().toISOString() })
              .eq("id", dealId)
              .eq("organization_id", data.organization_id);
          } else { runStatus = "error"; runErr = "deal_id/to_stage ausente"; }
        } else if (rule.action_type === "assign_owner") {
          const dealId = data.payload.deal_id as string | undefined;
          const newOwner = (cfg.user_id as string | undefined) ?? userId;
          if (dealId && newOwner) {
            await supabase
              .from("deals")
              .update({ user_id: newOwner, updated_at: new Date().toISOString() })
              .eq("id", dealId)
              .eq("organization_id", data.organization_id);
          } else { runStatus = "error"; runErr = "deal_id ausente"; }
        } else if (rule.action_type === "create_recommendation") {
          await supabase.from("recommendations").insert({
            organization_id: data.organization_id,
            surface: String(cfg.surface ?? "dashboard"),
            title: String(cfg.title ?? "Ação recomendada"),
            reason: cfg.reason ? String(cfg.reason) : `Disparado por ${data.event}`,
            action_label: String(cfg.action_label ?? "Abrir"),
            action_href: cfg.action_href ? String(cfg.action_href) : null,
            priority: Math.max(50, Math.min(99, Number(cfg.priority ?? 75))),
            source: "automation",
            expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          });
        } else {
          runStatus = "error";
          runErr = `Tipo de ação desconhecido: ${rule.action_type}`;
        }

        if (runStatus === "success") {
          await supabase
            .from("automations")
            .update({ run_count: (rule.run_count ?? 0) + 1, last_run_at: new Date().toISOString() })
            .eq("id", rule.id);
          executed++;
        }
      } catch (e: any) {
        runStatus = "error";
        runErr = e?.message ?? String(e);
        console.error("automation execution failed", rule.id, e);
      }

      await supabase.from("automation_runs").insert({
        organization_id: data.organization_id,
        automation_id: rule.id,
        trigger_event: data.event,
        payload: data.payload,
        status: runStatus,
        error: runErr,
        duration_ms: Date.now() - t0,
      });
    }

    return { matched: rules.length, executed };
  });

const listInput = z.object({ organization_id: z.string().uuid(), limit: z.number().min(1).max(200).default(50) });
export const listAutomationRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => listInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: runs, error } = await context.supabase
      .from("automation_runs")
      .select("*, automations(name, action_type)")
      .eq("organization_id", data.organization_id)
      .order("started_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { runs: runs ?? [] };
  });

