import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAY = 86400000;

const listInput = z.object({
  organization_id: z.string().uuid(),
  surface: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(6),
});

const resolveInput = z.object({
  organization_id: z.string().uuid(),
  id: z.string().uuid(),
  status: z.enum(["done", "dismissed"]),
});

const generateInput = z.object({
  organization_id: z.string().uuid(),
});

/**
 * List active recommendations for a given surface (e.g. "dashboard",
 * "pipeline", "carteira", "marketing"). Ordered by priority desc, then
 * expected $ impact desc. Cheap read — every screen calls this.
 */
export const listRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => listInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("recommendations")
      .select("*")
      .eq("organization_id", data.organization_id)
      .eq("surface", data.surface)
      .eq("status", "open")
      .order("priority", { ascending: false })
      .order("impact_brl", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

export const resolveRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => resolveInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("recommendations")
      .update({
        status: data.status,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
      })
      .eq("id", data.id)
      .eq("organization_id", data.organization_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type Draft = {
  surface: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string | null;
  priority: number;
  impact_brl?: number;
  title: string;
  reason: string;
  action_label: string;
  action_href: string;
  source: string;
};

/**
 * Regenerate the heuristic recommendation queue for the org.
 * Idempotent: wipes 'heuristic' open recs, then re-inserts based on current data.
 * AI-sourced recs (source='ai') are preserved.
 */
export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => generateInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organization_id;
    const now = Date.now();

    const [dealsRes, actsRes, invRes, compRes, leadsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("id, title, value, stage, expected_close, updated_at, company_id, user_id, contact_id")
        .eq("organization_id", org),
      supabase
        .from("activities")
        .select("id, deal_id, completed, due_date, created_at, user_id")
        .eq("organization_id", org)
        .gte("created_at", new Date(now - 120 * DAY).toISOString()),
      supabase
        .from("invoices")
        .select("id, company_id, amount, status, due_date")
        .eq("organization_id", org),
      supabase
        .from("companies")
        .select("id, name")
        .eq("organization_id", org),
      supabase
        .from("marketing_leads")
        .select("id, name, status, channel, created_at, converted_deal_id")
        .eq("organization_id", org)
        .gte("created_at", new Date(now - 30 * DAY).toISOString())
        .limit(200),
    ]);

    const deals = dealsRes.data ?? [];
    const acts = actsRes.data ?? [];
    const invoices = (invRes.data ?? []) as any[];
    const companies = compRes.data ?? [];
    const leads = (leadsRes.data ?? []) as any[];
    const compName = new Map(companies.map((c: any) => [c.id, c.name]));

    const lastActByDeal = new Map<string, number>();
    for (const a of acts) {
      if (!a.deal_id) continue;
      const t = a.due_date ? new Date(a.due_date).getTime() : new Date(a.created_at).getTime();
      const cur = lastActByDeal.get(a.deal_id) ?? 0;
      if (t > cur) lastActByDeal.set(a.deal_id, t);
    }

    const drafts: Draft[] = [];

    // 1) Negócios silenciosos de alto valor (pipeline + dashboard)
    const openDeals = deals.filter((d: any) => d.stage !== "won" && d.stage !== "lost");
    const silent = openDeals
      .map((d: any) => {
        const last = lastActByDeal.get(d.id) ?? new Date(d.updated_at).getTime();
        const daysSilent = Math.floor((now - last) / DAY);
        return { d, daysSilent };
      })
      .filter((x) => x.daysSilent >= 7)
      .sort((a, b) => Number(b.d.value ?? 0) - Number(a.d.value ?? 0))
      .slice(0, 8);

    for (const { d, daysSilent } of silent) {
      const value = Number(d.value ?? 0);
      const priority = Math.min(95, 50 + Math.floor(daysSilent / 2) + (value > 50000 ? 15 : 0));
      drafts.push({
        surface: "pipeline",
        entity_type: "deal",
        entity_id: d.id,
        user_id: d.user_id ?? null,
        priority,
        impact_brl: value,
        title: `Negócio parado há ${daysSilent}d: ${d.title}`,
        reason: `${compName.get(d.company_id) ?? "Empresa"} • Estágio ${d.stage}. Sem atividade há ${daysSilent} dias.`,
        action_label: "Agendar follow-up",
        action_href: `/deals/${d.id}`,
        source: "heuristic",
      });
    }
    // Top 3 também aparecem no dashboard
    for (const { d, daysSilent } of silent.slice(0, 3)) {
      drafts.push({
        surface: "dashboard",
        entity_type: "deal",
        entity_id: d.id,
        user_id: d.user_id ?? null,
        priority: 85,
        impact_brl: Number(d.value ?? 0),
        title: `Retomar ${d.title}`,
        reason: `Parado há ${daysSilent}d • ${compName.get(d.company_id) ?? "—"}`,
        action_label: "Abrir negócio",
        action_href: `/deals/${d.id}`,
        source: "heuristic",
      });
    }

    // 2) Inadimplência (carteira + dashboard)
    const overdueByCompany = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status === "paid") continue;
      const due = inv.due_date ? new Date(inv.due_date).getTime() : 0;
      if (due && due < now) {
        overdueByCompany.set(
          inv.company_id,
          (overdueByCompany.get(inv.company_id) ?? 0) + Number(inv.amount ?? 0),
        );
      }
    }
    const overdueTop = [...overdueByCompany.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [companyId, amount] of overdueTop) {
      drafts.push({
        surface: "carteira",
        entity_type: "company",
        entity_id: companyId,
        priority: 90,
        impact_brl: amount,
        title: `Cobrar ${compName.get(companyId) ?? "cliente"}`,
        reason: `Faturas vencidas somam ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
        action_label: "Abrir cliente",
        action_href: `/contacts/${companyId}`,
        source: "heuristic",
      });
    }

    // 3) Leads novos não convertidos (marketing + dashboard)
    const hotLeads = leads
      .filter((l) => !l.converted_deal_id && l.status !== "lost" && l.status !== "won")
      .slice(0, 6);
    for (const l of hotLeads) {
      drafts.push({
        surface: "marketing",
        entity_type: "lead",
        entity_id: l.id,
        priority: 80,
        title: `Lead novo: ${l.name ?? "sem nome"}`,
        reason: `Canal ${l.channel} • status ${l.status}. Velocidade é tudo aqui.`,
        action_label: "Qualificar agora",
        action_href: `/leads`,
        source: "heuristic",
      });
    }
    for (const l of hotLeads.slice(0, 2)) {
      drafts.push({
        surface: "dashboard",
        entity_type: "lead",
        entity_id: l.id,
        priority: 75,
        title: `Atacar lead ${l.name ?? "novo"}`,
        reason: `Canal ${l.channel}`,
        action_label: "Abrir lead",
        action_href: `/leads`,
        source: "heuristic",
      });
    }

    // 4) Fechamento esperado em 7d (pipeline + dashboard)
    const in7 = now + 7 * DAY;
    const closingSoon = openDeals
      .filter((d: any) => d.expected_close && new Date(d.expected_close).getTime() <= in7)
      .sort((a: any, b: any) => Number(b.value ?? 0) - Number(a.value ?? 0))
      .slice(0, 5);
    for (const d of closingSoon) {
      drafts.push({
        surface: "pipeline",
        entity_type: "deal",
        entity_id: d.id,
        user_id: d.user_id ?? null,
        priority: 88,
        impact_brl: Number(d.value ?? 0),
        title: `Fechar ${d.title} em ${Math.max(1, Math.ceil((new Date(d.expected_close as string).getTime() - now) / DAY))}d`,
        reason: `Previsão de fechamento próxima. ${compName.get(d.company_id) ?? ""}`.trim(),
        action_label: "Acelerar negociação",
        action_href: `/deals/${d.id}`,
        source: "heuristic",
      });
    }

    // 5) WhatsApp SLA: conversas violadas viram ações urgentes
    const { data: slaPols } = await supabase
      .from("whatsapp_sla_policies")
      .select("priority,first_response_minutes,resolution_minutes")
      .eq("organization_id", org);
    const polByPrio = new Map<string, { first: number; resolve: number }>();
    for (const p of slaPols ?? []) {
      polByPrio.set(p.priority, { first: p.first_response_minutes, resolve: p.resolution_minutes });
    }
    const { data: openConvs } = await supabase
      .from("whatsapp_conversations")
      .select("id,contact_name,priority,assigned_to,first_message_at,last_customer_message_at,first_response_at")
      .eq("organization_id", org)
      .neq("status", "resolved")
      .limit(200);
    for (const c of openConvs ?? []) {
      if (c.first_response_at) continue;
      const pol = polByPrio.get(c.priority) ?? { first: 15, resolve: 240 };
      const startedAt = new Date(c.last_customer_message_at ?? c.first_message_at).getTime();
      const due = startedAt + pol.first * 60_000;
      if (now <= due) continue;
      const overdueMin = Math.round((now - due) / 60_000);
      drafts.push({
        surface: "whatsapp",
        entity_type: "wa_conversation",
        entity_id: c.id,
        user_id: c.assigned_to ?? null,
        priority: 95,
        impact_brl: undefined,
        title: `Responder ${c.contact_name} (SLA violado há ${overdueMin}min)`,
        reason: "Conversa de WhatsApp aguardando primeira resposta além do SLA.",
        action_label: "Abrir conversa",
        action_href: `/whatsapp?c=${c.id}`,
        source: "heuristic",
      });
    }

    // 6) Influenciadores com tráfego sem conversão (ROI negativo / 0)
    const { data: infs } = await supabase
      .from("influencers")
      .select("id,name")
      .eq("organization_id", org)
      .eq("is_active", true);
    if (infs && infs.length) {
      const since = new Date(now - 30 * DAY).toISOString();
      const [{ data: vis }, { data: conv }] = await Promise.all([
        supabase.from("influencer_visits").select("influencer_id").eq("organization_id", org).gte("created_at", since),
        supabase.from("influencer_conversions").select("influencer_id,status,value").eq("organization_id", org).gte("created_at", since),
      ]);
      const vByInf = new Map<string, number>();
      for (const v of vis ?? []) vByInf.set(v.influencer_id, (vByInf.get(v.influencer_id) ?? 0) + 1);
      const wonByInf = new Map<string, number>();
      for (const c of conv ?? []) {
        if (c.status === "won" || c.status === "paid")
          wonByInf.set(c.influencer_id, (wonByInf.get(c.influencer_id) ?? 0) + Number(c.value ?? 0));
      }
      for (const inf of infs) {
        const v = vByInf.get(inf.id) ?? 0;
        const won = wonByInf.get(inf.id) ?? 0;
        if (v >= 50 && won === 0) {
          drafts.push({
            surface: "influencers",
            entity_type: "influencer",
            entity_id: inf.id,
            user_id: undefined,
            priority: 65,
            impact_brl: undefined,
            title: `Revisar campanha de ${inf.name} — ${v} visitas, 0 conversão`,
            reason: "Tráfego significativo nos últimos 30d sem nenhuma conversão registrada.",
            action_label: "Abrir influenciador",
            action_href: `/influencers`,
            source: "heuristic",
          });
        }
      }
    }


    // ============================================================
    // BLOCOS DE CRESCIMENTO / RETENÇÃO / PRODUTIVIDADE
    // ============================================================
    const STAGE_PROB: Record<string, number> = {
      lead: 10, qualified: 30, proposal: 55, negotiation: 75, won: 100, lost: 0,
    };

    const [goalsRes, profilesRes, membersRes, contactsRes] = await Promise.all([
      supabase.from("sales_goals").select("user_id, period_month, target_value").eq("organization_id", org),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("memberships").select("user_id, role").eq("organization_id", org),
      supabase.from("contacts").select("id, company_id").eq("organization_id", org),
    ]);
    const goals = goalsRes.data ?? [];
    const profiles = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p.full_name ?? "Vendedor"]));
    const members = membersRes.data ?? [];
    const contacts = contactsRes.data ?? [];

    // 7) FORECAST — gap-to-goal por vendedor (mês corrente)
    const today = new Date();
    const cmStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const nmStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    type Rep = { uid: string; target: number; won: number; weighted: number };
    const reps = new Map<string, Rep>();
    const ensureRep = (uid: string | null | undefined) => {
      if (!uid) return null;
      if (!reps.has(uid)) reps.set(uid, { uid, target: 0, won: 0, weighted: 0 });
      return reps.get(uid)!;
    };
    for (const g of goals as any[]) {
      if (!g.user_id) continue;
      const gm = new Date(g.period_month);
      if (gm.getUTCFullYear() !== cmStart.getUTCFullYear() || gm.getUTCMonth() !== cmStart.getUTCMonth()) continue;
      const r = ensureRep(g.user_id);
      if (r) r.target += Number(g.target_value) || 0;
    }
    for (const d of deals as any[]) {
      const close = d.expected_close ? new Date(d.expected_close) : null;
      const inMonth = close && close >= cmStart && close < nmStart;
      const wonThisMonth = d.stage === "won" &&
        new Date(d.updated_at) >= cmStart && new Date(d.updated_at) < nmStart;
      if (!inMonth && !wonThisMonth) continue;
      const r = ensureRep(d.user_id);
      if (!r) continue;
      const value = Number(d.value) || 0;
      const prob = STAGE_PROB[d.stage] ?? 10;
      if (d.stage === "won") r.won += value;
      else if (d.stage !== "lost") r.weighted += value * (prob / 100);
    }
    let orgGap = 0;
    let orgTarget = 0;
    for (const r of reps.values()) {
      if (r.target <= 0) continue;
      orgTarget += r.target;
      const projected = r.won + r.weighted;
      const gap = Math.max(0, r.target - projected);
      orgGap += gap;
      const attainment = Math.round((projected / r.target) * 100);
      if (gap > 0 && attainment < 80) {
        const name = profiles.get(r.uid) ?? "Vendedor";
        drafts.push({
          surface: "forecast",
          entity_type: "user",
          entity_id: r.uid,
          user_id: r.uid,
          priority: attainment < 40 ? 92 : attainment < 60 ? 85 : 75,
          impact_brl: gap,
          title: `${name} está em ${attainment}% da meta`,
          reason: `Gap de ${gap.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} para fechar o mês. Priorizar deals em negociação.`,
          action_label: "Ver pipeline",
          action_href: `/pipeline`,
          source: "heuristic",
        });
      }
    }
    if (orgTarget > 0 && orgGap > 0) {
      const orgAttain = Math.round(((orgTarget - orgGap) / orgTarget) * 100);
      if (orgAttain < 80) {
        drafts.push({
          surface: "dashboard",
          priority: orgAttain < 50 ? 94 : 82,
          impact_brl: orgGap,
          title: `Fechar gap de meta: ${orgGap.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}`,
          reason: `Time está em ${orgAttain}% da meta agregada do mês. Forecast aponta déficit.`,
          action_label: "Abrir forecast",
          action_href: `/forecast`,
          source: "heuristic",
        });
      }
    }

    // 8) CHURN — empresas em risco alto + 9) EXPANSÃO
    const contactsByCompany = new Map<string, string[]>();
    for (const c of contacts as any[]) {
      if (!c.company_id) continue;
      const arr = contactsByCompany.get(c.company_id) ?? [];
      arr.push(c.id);
      contactsByCompany.set(c.company_id, arr);
    }
    type CoStat = { id: string; name: string; risk: number; daysSilent: number; wonValue: number; openValue: number; openCount: number; wonCount: number };
    const coStats: CoStat[] = [];
    for (const co of companies as any[]) {
      const cDeals = deals.filter((d: any) => d.company_id === co.id);
      const won = cDeals.filter((d: any) => d.stage === "won");
      const lost = cDeals.filter((d: any) => d.stage === "lost");
      const open = cDeals.filter((d: any) => d.stage !== "won" && d.stage !== "lost");
      const cContactIds = contactsByCompany.get(co.id) ?? [];
      const rel = acts.filter((a: any) =>
        (a.deal_id && cDeals.some((d: any) => d.id === a.deal_id)) ||
        (a.contact_id && cContactIds.includes(a.contact_id)),
      );
      const lastTs = Math.max(0,
        ...cDeals.map((d: any) => new Date(d.updated_at).getTime()),
        ...rel.map((a: any) => new Date(a.created_at).getTime()),
      );
      const daysSilent = lastTs ? Math.floor((now - lastTs) / DAY) : 9999;
      let risk = 0;
      if (daysSilent >= 90) risk += 45; else if (daysSilent >= 60) risk += 30; else if (daysSilent >= 30) risk += 15;
      const lossRate = cDeals.length ? lost.length / cDeals.length : 0;
      if (lossRate >= 0.5 && cDeals.length >= 2) risk += 20;
      if (open.length === 0 && won.length > 0) risk += 15;
      if (cContactIds.length === 0) risk += 10;
      risk = Math.min(100, risk);
      const wonValue = won.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
      const openValue = open.reduce((s: number, d: any) => s + Number(d.value || 0), 0);
      coStats.push({ id: co.id, name: co.name, risk, daysSilent, wonValue, openValue, openCount: open.length, wonCount: won.length });
    }

    // Churn top 5
    const churnTop = coStats.filter((c) => c.risk >= 60 && c.wonCount > 0)
      .sort((a, b) => b.wonValue - a.wonValue).slice(0, 5);
    for (const c of churnTop) {
      drafts.push({
        surface: "retention",
        entity_type: "company",
        entity_id: c.id,
        priority: c.risk >= 80 ? 90 : 80,
        impact_brl: c.wonValue,
        title: `Reativar ${c.name} (risco ${c.risk})`,
        reason: `${c.daysSilent === 9999 ? "Sem contato registrado" : `${c.daysSilent}d sem contato`}. Histórico de ${c.wonValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} em ganhos.`,
        action_label: "Abrir cliente",
        action_href: `/companies/${c.id}`,
        source: "heuristic",
      });
    }
    for (const c of churnTop.slice(0, 2)) {
      drafts.push({
        surface: "dashboard",
        entity_type: "company",
        entity_id: c.id,
        priority: 86,
        impact_brl: c.wonValue,
        title: `Risco de churn: ${c.name}`,
        reason: `Score ${c.risk}/100. Acionar antes de virar perda.`,
        action_label: "Plano de retenção",
        action_href: `/retention`,
        source: "heuristic",
      });
    }

    // Expansão top 5
    const expansionTop = coStats.filter((c) =>
      c.wonCount > 0 && c.risk < 60 && (c.openCount === 0 || c.openValue < c.wonValue * 0.3),
    ).sort((a, b) => b.wonValue - a.wonValue).slice(0, 5);
    for (const c of expansionTop) {
      const expectedTicket = Math.round(c.wonValue / Math.max(1, c.wonCount));
      drafts.push({
        surface: "retention",
        entity_type: "company",
        entity_id: c.id,
        priority: 70,
        impact_brl: expectedTicket,
        title: `Upsell em ${c.name}`,
        reason: c.openCount === 0
          ? `Cliente recorrente sem deal ativo. Ticket médio ${expectedTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}.`
          : `Pipeline aberto < 30% do histórico. Espaço claro para expandir.`,
        action_label: "Abrir oportunidade",
        action_href: `/companies/${c.id}`,
        source: "heuristic",
      });
    }

    // 10) PRODUTIVIDADE — gargalos individuais
    const userIds = Array.from(new Set(members.map((m: any) => m.user_id)));
    for (const uid of userIds) {
      const myActs = acts.filter((a: any) => a.user_id === uid);
      if (myActs.length < 5) continue;
      const completed = myActs.filter((a: any) => a.completed);
      const overdue = myActs.filter((a: any) =>
        !a.completed && a.due_date && new Date(a.due_date).getTime() < now,
      );
      const completionRate = completed.length / myActs.length;
      const name = profiles.get(uid) ?? "Vendedor";
      if (overdue.length >= 5) {
        drafts.push({
          surface: "productivity",
          entity_type: "user",
          entity_id: uid,
          user_id: uid,
          priority: 80,
          title: `${name} com ${overdue.length} tarefas atrasadas`,
          reason: `Backlog crescente derruba conversão. Redistribuir ou destravar com coaching 1:1.`,
          action_label: "Abrir agenda",
          action_href: `/mytasks`,
          source: "heuristic",
        });
      } else if (completionRate < 0.4 && myActs.length >= 10) {
        drafts.push({
          surface: "productivity",
          entity_type: "user",
          entity_id: uid,
          user_id: uid,
          priority: 70,
          title: `${name} executando ${Math.round(completionRate * 100)}% das tarefas`,
          reason: `Volume alto (${myActs.length}) mas baixa execução. Validar prioridades e remover bloqueios.`,
          action_label: "Coaching",
          action_href: `/coaching`,
          source: "heuristic",
        });
      }
    }


    // Wipe previous heuristic open recs, then bulk insert.
    await supabase
      .from("recommendations")
      .delete()
      .eq("organization_id", org)
      .eq("status", "open")
      .eq("source", "heuristic");

    if (drafts.length) {
      const rows = drafts.map((d) => ({ ...d, organization_id: org }));
      const { error } = await supabase.from("recommendations").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { generated: drafts.length };
  });
