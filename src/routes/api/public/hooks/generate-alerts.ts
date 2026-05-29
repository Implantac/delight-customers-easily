import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DAY = 86400000;
const now = () => Date.now();

type AlertRow = {
  organization_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string;
};

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

async function buildOrgRows(orgId: string): Promise<AlertRow[]> {
  const [deals, acts, contacts, members] = await Promise.all([
    supabaseAdmin.from("deals").select("id, title, value, stage, expected_close, updated_at, user_id").eq("organization_id", orgId),
    supabaseAdmin.from("activities").select("id, title, due_date, completed, contact_id, user_id").eq("organization_id", orgId),
    supabaseAdmin.from("contacts").select("id, name, created_at, user_id").eq("organization_id", orgId),
    supabaseAdmin.from("memberships").select("user_id").eq("organization_id", orgId),
  ]);

  const memberIds: string[] = (members.data ?? []).map((m: any) => m.user_id);
  if (!memberIds.length) return [];

  const rows: AlertRow[] = [];
  const push = (kind: string, title: string, body: string, link: string, userId?: string | null) => {
    const targets = userId ? [userId] : memberIds;
    for (const uid of targets) {
      rows.push({ organization_id: orgId, user_id: uid, type: `alert.${kind}`, title, body, link });
    }
  };

  for (const d of (deals.data ?? []) as any[]) {
    if (d.stage === "won" || d.stage === "lost") continue;
    const stale = Math.floor((now() - new Date(d.updated_at).getTime()) / DAY);
    if (stale >= 14) push("stale_deal", `Negócio parado: ${d.title}`, `${stale}d sem movimento · ${fmt(Number(d.value))}`, "/pipeline", d.user_id);
    if (Number(d.value) >= 50000 && stale >= 7) push("high_value_idle", `Alto valor sem ação: ${d.title}`, `${fmt(Number(d.value))} · ${stale}d`, "/pipeline", d.user_id);
    if (d.expected_close) {
      const days = Math.floor((new Date(d.expected_close).getTime() - now()) / DAY);
      if (days >= 0 && days <= 7) push("closing_soon", `Fecha em ${days}d: ${d.title}`, `${fmt(Number(d.value))}`, "/pipeline", d.user_id);
    }
  }

  const lastActByContact = new Map<string, number>();
  for (const a of (acts.data ?? []) as any[]) {
    if (!a.contact_id) continue;
    const t = new Date(a.due_date ?? "").getTime() || 0;
    const prev = lastActByContact.get(a.contact_id) ?? 0;
    if (t > prev) lastActByContact.set(a.contact_id, t);
  }
  for (const c of (contacts.data ?? []) as any[]) {
    const last = lastActByContact.get(c.id) ?? new Date(c.created_at).getTime();
    const days = Math.floor((now() - last) / DAY);
    if (days >= 60) push("silent_contact", `Cliente silencioso: ${c.name}`, `${days}d sem interação`, `/contacts/${c.id}`, c.user_id);
  }

  for (const a of (acts.data ?? []) as any[]) {
    if (a.completed || !a.due_date) continue;
    const overdue = Math.floor((now() - new Date(a.due_date).getTime()) / DAY);
    if (overdue >= 0) push("overdue_task", `Tarefa atrasada: ${a.title}`, overdue === 0 ? "Vence hoje" : `Atrasada há ${overdue}d`, "/activities", a.user_id);
  }

  return rows;
}

async function dedupeAgainstRecent(rows: AlertRow[]): Promise<AlertRow[]> {
  if (!rows.length) return [];
  const since = new Date(now() - DAY).toISOString();
  const orgIds = Array.from(new Set(rows.map((r) => r.organization_id)));
  const { data: recent } = await supabaseAdmin
    .from("notifications")
    .select("organization_id, user_id, type, body")
    .in("organization_id", orgIds)
    .gte("created_at", since);
  const seen = new Set<string>((recent ?? []).map((r: any) => `${r.organization_id}|${r.user_id}|${r.type}|${r.body}`));
  return rows.filter((r) => {
    const key = `${r.organization_id}|${r.user_id}|${r.type}|${r.body}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const Route = createFileRoute("/api/public/hooks/generate-alerts")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { data: orgs, error } = await supabaseAdmin.from("organizations").select("id");
          if (error) throw error;

          let totalGenerated = 0;
          let totalOrgs = 0;

          for (const o of orgs ?? []) {
            totalOrgs++;
            const rows = await buildOrgRows(o.id);
            const fresh = await dedupeAgainstRecent(rows);
            if (!fresh.length) continue;
            for (let i = 0; i < fresh.length; i += 500) {
              const chunk = fresh.slice(i, i + 500);
              const { error: insErr } = await supabaseAdmin.from("notifications").insert(chunk);
              if (insErr) throw insErr;
              totalGenerated += chunk.length;
            }
          }

          return new Response(
            JSON.stringify({ success: true, orgs_processed: totalOrgs, notifications_inserted: totalGenerated }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e: any) {
          console.error("generate-alerts failed:", e);
          return new Response(
            JSON.stringify({ success: false, error: e?.message ?? "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => new Response("Use POST", { status: 405 }),
    },
  },
});
