import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgInput = z.object({ organization_id: z.string().uuid() });

const DAY = 86400000;
const now = () => Date.now();
const daysAgo = (d: number) => new Date(now() - d * DAY).toISOString();

// ---------- Revenue Command Center ----------
export const computeCommandCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = data.organization_id;

    const [dealsRes, actsRes, contactsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, title, value, stage, expected_close, updated_at, contact_id, company_id, user_id, contacts(name), companies(name)")
        .eq("organization_id", org),
      supabase
        .from("activities")
        .select("id, title, type, due_date, completed, contact_id, deal_id, user_id")
        .eq("organization_id", org),
      supabase
        .from("contacts")
        .select("id, name, created_at")
        .eq("organization_id", org),
    ]);

    if (dealsRes.error) throw new Error(dealsRes.error.message);
    if (actsRes.error) throw new Error(actsRes.error.message);
    if (contactsRes.error) throw new Error(contactsRes.error.message);

    const deals = dealsRes.data ?? [];
    const acts = actsRes.data ?? [];
    const contacts = contactsRes.data ?? [];

    const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const won = deals.filter((d) => d.stage === "won");
    const wonValue = won.reduce((s, d) => s + Number(d.value), 0);
    const pipelineValue = open.reduce((s, d) => s + Number(d.value), 0);

    // last activity per contact
    const lastActByContact = new Map<string, number>();
    for (const a of acts) {
      if (!a.contact_id) continue;
      const t = new Date(a.due_date ?? "").getTime() || 0;
      const prev = lastActByContact.get(a.contact_id) ?? 0;
      if (t > prev) lastActByContact.set(a.contact_id, t);
    }

    const at_risk_deals = open
      .map((d) => {
        const updated = new Date(d.updated_at).getTime();
        const stale = Math.floor((now() - updated) / DAY);
        const stageWeight = d.stage === "negotiation" ? 1.5 : d.stage === "proposal" ? 1.2 : 1;
        const risk = Math.min(100, Math.round(stale * 1.2 * stageWeight));
        return { ...d, stale_days: stale, risk_score: risk };
      })
      .filter((d) => d.stale_days >= 14)
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 8);

    const value_at_risk = at_risk_deals.reduce((s, d) => s + Number(d.value), 0);

    const cutoff = now() - 60 * DAY;
    const silent_contacts = contacts
      .map((c) => {
        const last = lastActByContact.get(c.id) ?? new Date(c.created_at).getTime();
        return { ...c, last_touch: last, days_silent: Math.floor((now() - last) / DAY) };
      })
      .filter((c) => c.last_touch < cutoff)
      .sort((a, b) => b.days_silent - a.days_silent)
      .slice(0, 8);

    const overdue_tasks = acts
      .filter((a) => !a.completed && a.due_date && new Date(a.due_date).getTime() < now())
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 8);

    const my_overdue = overdue_tasks.filter((a) => a.user_id === userId).length;
    const my_open_deals = open.filter((d) => d.user_id === userId).length;

    // forecast 90d: open deals weighted by stage probability
    const probs: Record<string, number> = { lead: 0.1, qualified: 0.3, proposal: 0.5, negotiation: 0.75 };
    const forecast_90d = open.reduce((s, d) => s + Number(d.value) * (probs[d.stage] ?? 0.2), 0);

    // top reengagement opportunities (won deals from silent customers' companies)
    const wonByContact = new Set(won.map((d) => d.contact_id).filter(Boolean));
    const reengagement = silent_contacts
      .filter((c) => wonByContact.has(c.id))
      .slice(0, 5);

    // recommended actions
    const actions: { kind: string; title: string; reason: string; link?: string }[] = [];
    if (at_risk_deals.length) {
      const top = at_risk_deals[0];
      actions.push({
        kind: "deal_followup",
        title: `Retomar "${top.title}"`,
        reason: `Sem movimento há ${top.stale_days} dias · ${Number(top.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}`,
        link: "/pipeline",
      });
    }
    if (silent_contacts.length) {
      const top = silent_contacts[0];
      actions.push({
        kind: "reengage",
        title: `Reengajar ${top.name}`,
        reason: `${top.days_silent} dias sem contato`,
        link: `/contacts/${top.id}`,
      });
    }
    if (my_overdue > 0) {
      actions.push({
        kind: "task",
        title: `Concluir ${my_overdue} tarefa(s) atrasada(s)`,
        reason: "Suas atividades vencidas estão acumulando",
        link: "/activities",
      });
    }
    if (reengagement.length) {
      const top = reengagement[0];
      actions.push({
        kind: "upsell",
        title: `Oportunidade de recompra: ${top.name}`,
        reason: "Cliente que já fechou e está silencioso há semanas",
        link: `/contacts/${top.id}`,
      });
    }

    return {
      kpi: {
        pipeline_value: pipelineValue,
        forecast_90d,
        won_value: wonValue,
        won_count: won.length,
        open_count: open.length,
        value_at_risk,
        my_overdue,
        my_open_deals,
      },
      at_risk_deals,
      silent_contacts,
      overdue_tasks,
      reengagement,
      actions,
    };
  });

// ---------- Customer Health Score ----------
export const computeHealthScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    organization_id: z.string().uuid(),
    contact_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.contact_id && !data.company_id) throw new Error("contact_id ou company_id necessário");

    let contactIds: string[] = [];
    if (data.contact_id) contactIds = [data.contact_id];
    else {
      const { data: cs } = await supabase
        .from("contacts").select("id").eq("organization_id", data.organization_id).eq("company_id", data.company_id!);
      contactIds = (cs ?? []).map((c) => c.id);
    }
    if (contactIds.length === 0) return { score: 50, level: "atencao", reasons: ["Sem contatos vinculados"] };

    const [actsRes, dealsRes] = await Promise.all([
      supabase.from("activities")
        .select("type, due_date, completed, created_at, contact_id")
        .eq("organization_id", data.organization_id)
        .in("contact_id", contactIds),
      supabase.from("deals")
        .select("stage, value, updated_at, contact_id, company_id")
        .eq("organization_id", data.organization_id)
        .in("contact_id", contactIds),
    ]);

    const acts = actsRes.data ?? [];
    const deals = dealsRes.data ?? [];

    const reasons: string[] = [];
    let score = 50;

    // recency
    const lastActMs = acts.reduce((m, a) => {
      const t = new Date(a.due_date ?? a.created_at).getTime();
      return t > m ? t : m;
    }, 0);
    const daysSince = lastActMs ? Math.floor((now() - lastActMs) / DAY) : 999;
    if (daysSince <= 14) { score += 20; reasons.push(`Contato recente (${daysSince}d)`); }
    else if (daysSince <= 45) { score += 5; reasons.push(`Última interação há ${daysSince}d`); }
    else if (daysSince <= 90) { score -= 15; reasons.push(`Silente há ${daysSince}d`); }
    else { score -= 30; reasons.push(`Inativo há ${daysSince}d`); }

    // frequency last 90d
    const recent = acts.filter((a) => new Date(a.created_at).getTime() > now() - 90 * DAY).length;
    if (recent >= 6) { score += 15; reasons.push(`Alta frequência (${recent} atividades em 90d)`); }
    else if (recent >= 2) { score += 5; reasons.push(`${recent} atividades em 90d`); }
    else { score -= 10; reasons.push("Baixa frequência de interação"); }

    // deal wins / losses
    const won = deals.filter((d) => d.stage === "won").length;
    const lost = deals.filter((d) => d.stage === "lost").length;
    if (won > 0) { score += Math.min(20, won * 8); reasons.push(`${won} negócio(s) ganho(s)`); }
    if (lost > won) { score -= 15; reasons.push(`Mais perdas (${lost}) que ganhos`); }

    // overdue tasks
    const overdue = acts.filter((a) => !a.completed && a.due_date && new Date(a.due_date).getTime() < now()).length;
    if (overdue > 0) { score -= Math.min(20, overdue * 5); reasons.push(`${overdue} tarefa(s) atrasada(s)`); }

    score = Math.max(0, Math.min(100, score));
    const level = score >= 70 ? "saudavel" : score >= 40 ? "atencao" : "risco";
    return { score, level, reasons };
  });

// ---------- Rep Ranking ----------
export const getRepRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = daysAgo(90);

    const [dealsRes, actsRes, membersRes] = await Promise.all([
      supabase.from("deals").select("user_id, stage, value, updated_at, created_at")
        .eq("organization_id", data.organization_id),
      supabase.from("activities").select("user_id, completed, due_date, created_at")
        .eq("organization_id", data.organization_id).gte("created_at", since),
      supabase.from("memberships").select("user_id, role")
        .eq("organization_id", data.organization_id),
    ]);

    const deals = dealsRes.data ?? [];
    const acts = actsRes.data ?? [];
    const members = membersRes.data ?? [];

    // get profile names
    const userIds = Array.from(new Set(members.map((m) => m.user_id)));
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "—"]));

    const rows = userIds.map((uid) => {
      const myDeals = deals.filter((d) => d.user_id === uid);
      const myWon = myDeals.filter((d) => d.stage === "won");
      const myLost = myDeals.filter((d) => d.stage === "lost");
      const myActs = acts.filter((a) => a.user_id === uid);
      const myDone = myActs.filter((a) => a.completed).length;
      const myOverdue = myActs.filter((a) => !a.completed && a.due_date && new Date(a.due_date).getTime() < now()).length;
      const wonValue = myWon.reduce((s, d) => s + Number(d.value), 0);
      const closedCount = myWon.length + myLost.length;
      const winRate = closedCount ? (myWon.length / closedCount) * 100 : 0;
      const avgTicket = myWon.length ? wonValue / myWon.length : 0;
      const conversionScore =
        Math.min(40, winRate * 0.4) +
        Math.min(30, myDone * 1.5) +
        Math.min(20, (wonValue / 10000)) +
        Math.max(-15, -myOverdue * 2);

      return {
        user_id: uid,
        name: nameOf.get(uid) ?? "—",
        won_count: myWon.length,
        won_value: wonValue,
        win_rate: winRate,
        avg_ticket: avgTicket,
        activities_done: myDone,
        overdue: myOverdue,
        open_deals: myDeals.filter((d) => d.stage !== "won" && d.stage !== "lost").length,
        score: Math.round(Math.max(0, conversionScore)),
      };
    });

    return rows.sort((a, b) => b.score - a.score);
  });
