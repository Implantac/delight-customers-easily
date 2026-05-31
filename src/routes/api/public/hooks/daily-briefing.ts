import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCronApiKey } from "@/lib/cron-auth.server";

// Daily briefing — uma notificação por usuário às 07:30 BRT:
// Pipeline, tarefas hoje, atrasadas, top oportunidade, top 3 riscos,
// próxima ação prioritária. Lê da fila unificada `recommendations`.

const DAY = 86400000;
const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Row = {
  organization_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string;
};

async function briefForOrg(orgId: string): Promise<Row[]> {
  const now = Date.now();
  const in7 = new Date(now + 7 * DAY).toISOString();
  const [members, deals, acts, recs, invoices] = await Promise.all([
    supabaseAdmin.from("memberships").select("user_id").eq("organization_id", orgId),
    supabaseAdmin.from("deals")
      .select("id, title, value, stage, user_id, expected_close, company_id")
      .eq("organization_id", orgId)
      .not("stage", "in", "(won,lost)"),
    supabaseAdmin.from("activities")
      .select("id, due_date, completed, user_id")
      .eq("organization_id", orgId)
      .eq("completed", false),
    supabaseAdmin.from("recommendations")
      .select("user_id, title, priority, impact_brl, action_href, surface")
      .eq("organization_id", orgId)
      .eq("status", "open")
      .order("priority", { ascending: false })
      .limit(200),
    supabaseAdmin.from("invoices")
      .select("amount, status, due_date, company_id")
      .eq("organization_id", orgId)
      .neq("status", "paid"),
  ]);

  const allRecs = (recs.data ?? []) as any[];
  const allInvoices = (invoices.data ?? []) as any[];
  const overdueTotal = allInvoices
    .filter((i) => i.due_date && new Date(i.due_date).getTime() < now)
    .reduce((s, i) => s + Number(i.amount ?? 0), 0);

  const rows: Row[] = [];
  for (const m of (members.data ?? []) as any[]) {
    const uid = m.user_id;
    const myDeals = ((deals.data ?? []) as any[]).filter((d) => d.user_id === uid);
    const myActs = ((acts.data ?? []) as any[]).filter((a) => a.user_id === uid && a.due_date);
    const myRecs = allRecs.filter((r) => !r.user_id || r.user_id === uid);

    const overdue = myActs.filter((a) => new Date(a.due_date).getTime() < now).length;
    const today = myActs.filter((a) => {
      const t = new Date(a.due_date).getTime();
      return t >= now - DAY && t <= now + DAY;
    }).length;
    const closingSoon = myDeals.filter((d) => d.expected_close && d.expected_close <= in7).length;
    const pipelineValue = myDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);

    // Top 3 oportunidades (priority desc, impact desc)
    const opportunities = myRecs
      .filter((r) => r.surface === "pipeline" || r.surface === "marketing" || r.surface === "dashboard")
      .slice(0, 3);

    // Top 3 riscos (carteira + alta prioridade)
    const risks = myRecs
      .filter((r) => r.surface === "carteira" || r.priority >= 88)
      .slice(0, 3);

    // Ação prioritária (single)
    const priorityAction = myRecs[0];

    const lines: string[] = [];
    lines.push(`📊 Pipeline: ${myDeals.length} negócios · ${fmt(pipelineValue)}`);
    if (today) lines.push(`📌 ${today} tarefa(s) hoje`);
    if (overdue) lines.push(`⚠️ ${overdue} atrasada(s)`);
    if (closingSoon) lines.push(`🎯 ${closingSoon} fecha(m) em 7d`);
    if (overdueTotal > 0) lines.push(`💰 Inadimplência: ${fmt(overdueTotal)}`);

    if (opportunities.length) {
      lines.push(`🚀 Top oportunidades: ${opportunities.map((o) => o.title).join(" • ")}`);
    }
    if (risks.length) {
      lines.push(`🛑 Riscos: ${risks.map((r) => r.title).join(" • ")}`);
    }
    if (priorityAction) {
      lines.push(`👉 Comece por: ${priorityAction.title}`);
    }

    if (lines.length <= 1 && !myDeals.length && !myActs.length) continue;

    rows.push({
      organization_id: orgId,
      user_id: uid,
      type: "briefing.daily",
      title: "Seu plano do dia",
      body: lines.join(" · "),
      link: priorityAction?.action_href ?? "/command",
    });
  }
  return rows;
}

async function dedupeToday(rows: Row[]): Promise<Row[]> {
  if (!rows.length) return [];
  const since = new Date(Date.now() - DAY).toISOString();
  const orgIds = Array.from(new Set(rows.map((r) => r.organization_id)));
  const { data: recent } = await supabaseAdmin
    .from("notifications")
    .select("organization_id, user_id, type")
    .in("organization_id", orgIds)
    .eq("type", "briefing.daily")
    .gte("created_at", since);
  const seen = new Set<string>((recent ?? []).map((r: any) => `${r.organization_id}|${r.user_id}`));
  return rows.filter((r) => !seen.has(`${r.organization_id}|${r.user_id}`));
}

export const Route = createFileRoute("/api/public/hooks/daily-briefing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronApiKey(request);
        if (unauth) return unauth;
        try {
          const { data: orgs, error } = await supabaseAdmin.from("organizations").select("id");
          if (error) throw error;
          let totalGenerated = 0;
          let totalOrgs = 0;
          for (const o of orgs ?? []) {
            totalOrgs++;
            const rows = await briefForOrg(o.id);
            const fresh = await dedupeToday(rows);
            if (!fresh.length) continue;
            for (let i = 0; i < fresh.length; i += 500) {
              const chunk = fresh.slice(i, i + 500);
              const { error: insErr } = await supabaseAdmin.from("notifications").insert(chunk);
              if (insErr) throw insErr;
              totalGenerated += chunk.length;
            }
          }
          return new Response(
            JSON.stringify({ success: true, orgs_processed: totalOrgs, briefings_sent: totalGenerated }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e: any) {
          console.error("daily-briefing failed:", e);
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
