/**
 * Executor das automações comerciais. Roda no cron diário e materializa
 * tasks/notificações/whatsapp baseado nas regras configuradas em
 * `commercial_automations`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type ActionDef = { type: string; template?: string };

const DAY = 86400000;

async function pickDefaultWhatsAppChannel(supabase: SupabaseClient, orgId: string) {
  const { data } = await supabase
    .from("whatsapp_channels")
    .select("id")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

function render(tpl: string | undefined, vars: Record<string, string>): string {
  const t = tpl ?? "{name}";
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

async function applyActions(
  supabase: SupabaseClient,
  orgId: string,
  company: { id: string; name: string; assigned_user_id?: string | null; phone?: string | null },
  actions: ActionDef[],
  triggerLabel: string,
) {
  const waChannel = actions.some((a) => a.type === "send_whatsapp")
    ? await pickDefaultWhatsAppChannel(supabase, orgId)
    : null;
  const vars = { name: company.name, trigger: triggerLabel };

  for (const a of actions) {
    if (a.type === "create_task" || a.type === "suggest_visit") {
      await supabase.from("activities").insert({
        organization_id: orgId,
        user_id: company.assigned_user_id ?? null,
        type: a.type === "suggest_visit" ? "meeting" : "task",
        title: render(a.template ?? `${triggerLabel} — ${company.name}`, vars),
        due_date: new Date(Date.now() + DAY).toISOString(),
      });
    } else if (a.type === "create_notification") {
      await supabase.from("notifications").insert({
        organization_id: orgId,
        user_id: company.assigned_user_id ?? null,
        type: "automation",
        title: triggerLabel,
        body: render(a.template ?? `Cliente ${company.name} acionou regra ${triggerLabel}`, vars),
        link: `/companies/${company.id}`,
      });
    } else if (a.type === "send_whatsapp" && waChannel && company.phone) {
      await supabase.from("whatsapp_outbox").insert({
        organization_id: orgId,
        channel_id: waChannel,
        to_phone: company.phone,
        body: render(a.template ?? `Olá ${company.name}, sentimos sua falta!`, vars),
      });
    }
  }
}

export async function runAutomationsForOrg(supabase: SupabaseClient, orgId: string) {
  const { data: rules } = await supabase
    .from("commercial_automations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("enabled", true);

  let totalMatched = 0;
  for (const rule of (rules ?? []) as any[]) {
    let matched = 0;
    const threshold = Number(rule.threshold ?? 0);
    const actions = (rule.actions ?? []) as ActionDef[];

    if (rule.trigger_type === "no_purchase_days") {
      const cutoff = new Date(Date.now() - threshold * DAY).toISOString();
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, phone, assigned_user_id, last_purchase_at")
        .eq("organization_id", orgId)
        .lt("last_purchase_at", cutoff)
        .limit(50);
      for (const c of (companies ?? []) as any[]) {
        await applyActions(supabase, orgId, c, actions, `${threshold}d sem compra`);
        matched++;
      }
    } else if (rule.trigger_type === "churn_risk_high") {
      const { data: churn } = await supabase
        .from("ai_churn_predictions")
        .select("company_id, risk_score, companies(id, name, phone, assigned_user_id)")
        .eq("organization_id", orgId)
        .gte("risk_score", (threshold || 70) / 100)
        .limit(50);
      for (const r of (churn ?? []) as any[]) {
        const c = r.companies;
        if (!c) continue;
        await applyActions(supabase, orgId, c, actions, "Risco alto de churn");
        matched++;
      }
    } else if (rule.trigger_type === "new_lead_no_contact") {
      const since = new Date(Date.now() - threshold * DAY).toISOString();
      const { data: leads } = await supabase
        .from("marketing_leads")
        .select("id, name, phone, organization_id")
        .eq("organization_id", orgId)
        .eq("status", "new")
        .lt("created_at", since)
        .limit(50);
      for (const l of (leads ?? []) as any[]) {
        await applyActions(
          supabase,
          orgId,
          { id: l.id, name: l.name, phone: l.phone },
          actions,
          "Lead sem contato",
        );
        matched++;
      }
    }

    totalMatched += matched;
    await supabase
      .from("commercial_automations")
      .update({ last_run_at: new Date().toISOString(), last_run_matched: matched })
      .eq("id", rule.id);
  }
  return { rules: rules?.length ?? 0, matched: totalMatched };
}
