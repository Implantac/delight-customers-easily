import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAY = 86400000;
const now = () => Date.now();

const orgInput = z.object({ organization_id: z.string().uuid() });

export type AlertItem = {
  kind: "stale_deal" | "silent_contact" | "overdue_task" | "closing_soon" | "high_value_idle";
  severity: "high" | "medium" | "low";
  title: string;
  body: string;
  link: string;
  entity_id: string;
  user_id?: string | null;
};

async function computeAlertsForOrg(supabase: any, organization_id: string): Promise<AlertItem[]> {
  const [dealsRes, actsRes, contactsRes] = await Promise.all([
    supabase
      .from("deals")
      .select("id, title, value, stage, expected_close, updated_at, user_id")
      .eq("organization_id", organization_id),
    supabase
      .from("activities")
      .select("id, title, due_date, completed, contact_id, deal_id, user_id")
      .eq("organization_id", organization_id),
    supabase
      .from("contacts")
      .select("id, name, created_at, user_id")
      .eq("organization_id", organization_id),
  ]);
  if (dealsRes.error) throw new Error(dealsRes.error.message);
  if (actsRes.error) throw new Error(actsRes.error.message);
  if (contactsRes.error) throw new Error(contactsRes.error.message);

  const deals = dealsRes.data ?? [];
  const acts = actsRes.data ?? [];
  const contacts = contactsRes.data ?? [];
  const open = deals.filter((d: any) => d.stage !== "won" && d.stage !== "lost");

  const alerts: AlertItem[] = [];
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  // Stale deals
  for (const d of open) {
    const stale = Math.floor((now() - new Date(d.updated_at).getTime()) / DAY);
    if (stale >= 14) {
      const sev: AlertItem["severity"] = stale >= 45 ? "high" : stale >= 30 ? "medium" : "low";
      alerts.push({
        kind: "stale_deal",
        severity: sev,
        title: `Negócio parado: ${d.title}`,
        body: `${stale} dias sem movimento · ${fmt(Number(d.value))}`,
        link: `/pipeline`,
        entity_id: d.id,
        user_id: d.user_id,
      });
    }
    if (Number(d.value) >= 50000 && stale >= 7) {
      alerts.push({
        kind: "high_value_idle",
        severity: "high",
        title: `Alto valor sem ação: ${d.title}`,
        body: `${fmt(Number(d.value))} · ${stale}d desde o último update`,
        link: `/pipeline`,
        entity_id: d.id,
        user_id: d.user_id,
      });
    }
    if (d.expected_close) {
      const daysToClose = Math.floor((new Date(d.expected_close).getTime() - now()) / DAY);
      if (daysToClose >= 0 && daysToClose <= 7) {
        alerts.push({
          kind: "closing_soon",
          severity: "medium",
          title: `Fecha em ${daysToClose}d: ${d.title}`,
          body: `${fmt(Number(d.value))} · estágio ${d.stage}`,
          link: `/pipeline`,
          entity_id: d.id,
          user_id: d.user_id,
        });
      }
    }
  }

  // Silent contacts
  const lastActByContact = new Map<string, number>();
  for (const a of acts) {
    if (!a.contact_id) continue;
    const t = new Date(a.due_date ?? "").getTime() || 0;
    const prev = lastActByContact.get(a.contact_id) ?? 0;
    if (t > prev) lastActByContact.set(a.contact_id, t);
  }
  for (const c of contacts) {
    const last = lastActByContact.get(c.id) ?? new Date(c.created_at).getTime();
    const days = Math.floor((now() - last) / DAY);
    if (days >= 60) {
      alerts.push({
        kind: "silent_contact",
        severity: days >= 120 ? "high" : "medium",
        title: `Cliente silencioso: ${c.name}`,
        body: `${days} dias sem interação`,
        link: `/contacts/${c.id}`,
        entity_id: c.id,
        user_id: c.user_id,
      });
    }
  }

  // Overdue tasks
  for (const a of acts) {
    if (a.completed || !a.due_date) continue;
    const overdue = Math.floor((now() - new Date(a.due_date).getTime()) / DAY);
    if (overdue >= 0) {
      alerts.push({
        kind: "overdue_task",
        severity: overdue >= 7 ? "high" : overdue >= 2 ? "medium" : "low",
        title: `Tarefa atrasada: ${a.title}`,
        body: overdue === 0 ? "Vence hoje" : `Atrasada há ${overdue}d`,
        link: `/activities`,
        entity_id: a.id,
        user_id: a.user_id,
      });
    }
  }

  // ordena por severidade
  const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  alerts.sort((a, b) => rank[b.severity] - rank[a.severity]);
  return alerts;
}

// Lista alertas calculados (sem persistir)
export const listAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const alerts = await computeAlertsForOrg(context.supabase, data.organization_id);
    return { alerts, counts: countBySeverity(alerts) };
  });

// Gera notificações no banco para os alertas atuais, deduplicando por (user, type, entity) em 24h
export const generateAlertNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const alerts = await computeAlertsForOrg(supabase, data.organization_id);

    // pega membros para distribuir notificação ao owner quando user_id da entidade não estiver presente
    const { data: members } = await supabase
      .from("memberships").select("user_id").eq("organization_id", data.organization_id);
    const memberIds: string[] = (members ?? []).map((m: any) => m.user_id);

    // alertas recentes (24h) — evita duplicar
    const since = new Date(now() - DAY).toISOString();
    const { data: recent } = await supabase
      .from("notifications")
      .select("user_id, type, body")
      .gte("created_at", since);
    const seen = new Set<string>((recent ?? []).map((r: any) => `${r.user_id}|${r.type}|${r.body}`));

    const rows: any[] = [];
    for (const a of alerts) {
      const targets = a.user_id ? [a.user_id] : memberIds;
      for (const uid of targets) {
        const key = `${uid}|alert.${a.kind}|${a.body}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          organization_id: data.organization_id,
          user_id: uid,
          type: `alert.${a.kind}`,
          title: a.title,
          body: a.body,
          link: a.link,
        });
      }
    }

    let inserted = 0;
    if (rows.length) {
      // chunk insert para evitar payload grande
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error, count } = await supabase
          .from("notifications").insert(chunk, { count: "exact" });
        if (error) throw new Error(error.message);
        inserted += count ?? chunk.length;
      }
    }

    return { generated: inserted, total_alerts: alerts.length, triggered_by: userId };
  });

function countBySeverity(items: AlertItem[]) {
  return items.reduce(
    (acc, a) => {
      acc[a.severity]++;
      acc.total++;
      return acc;
    },
    { high: 0, medium: 0, low: 0, total: 0 } as Record<string, number>,
  );
}
