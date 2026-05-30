import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  organization_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
});

export type NextAction = {
  id: string;
  kind:
    | "overdue_task"
    | "hot_lead_no_contact"
    | "deal_stalled"
    | "deal_high_value"
    | "deal_closing_soon"
    | "no_activity_week";
  priority: number; // 0-100
  title: string;
  reason: string;
  cta: string;
  link: string;
  meta?: Record<string, string | number | null>;
};

const KIND_WEIGHT: Record<NextAction["kind"], number> = {
  overdue_task: 90,
  deal_closing_soon: 85,
  hot_lead_no_contact: 75,
  deal_high_value: 70,
  deal_stalled: 55,
  no_activity_week: 35,
};

export const getCoaching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const targetUser = data.user_id ?? userId;
    const now = Date.now();
    const today = new Date(now);
    const sevenDaysAgo = new Date(now - 7 * 86400_000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 86400_000).toISOString();
    const next14 = new Date(now + 14 * 86400_000).toISOString();

    const [overdueRes, dealsRes, recentActsRes] = await Promise.all([
      supabase
        .from("activities")
        .select("id, title, due_date, contact_id, deal_id")
        .eq("organization_id", data.organization_id)
        .eq("user_id", targetUser)
        .eq("completed", false)
        .lt("due_date", today.toISOString())
        .order("due_date", { ascending: true })
        .limit(50),
      supabase
        .from("deals")
        .select("id, title, value, stage, expected_close, updated_at, contact_id, company_id")
        .eq("organization_id", data.organization_id)
        .eq("user_id", targetUser)
        .not("stage", "in", "(won,lost)")
        .limit(500),
      supabase
        .from("activities")
        .select("deal_id, contact_id, created_at")
        .eq("organization_id", data.organization_id)
        .eq("user_id", targetUser)
        .gte("created_at", fourteenDaysAgo)
        .limit(1000),
    ]);

    const overdue = overdueRes.data ?? [];
    const deals = (dealsRes.data ?? []) as Array<{
      id: string; title: string; value: number | null; stage: string;
      expected_close: string | null; updated_at: string;
      contact_id: string | null; company_id: string | null;
    }>;
    const recentActs = recentActsRes.data ?? [];

    const actsByDeal = new Map<string, string>();
    const actsByContact = new Map<string, string>();
    for (const a of recentActs as Array<{ deal_id: string | null; contact_id: string | null; created_at: string }>) {
      if (a.deal_id && !actsByDeal.has(a.deal_id)) actsByDeal.set(a.deal_id, a.created_at);
      if (a.contact_id && !actsByContact.has(a.contact_id)) actsByContact.set(a.contact_id, a.created_at);
    }

    const actions: NextAction[] = [];

    for (const t of overdue) {
      const days = Math.max(1, Math.floor((now - new Date((t as any).due_date).getTime()) / 86400_000));
      actions.push({
        id: `task-${(t as any).id}`,
        kind: "overdue_task",
        priority: Math.min(100, KIND_WEIGHT.overdue_task + Math.min(10, days)),
        title: (t as any).title ?? "Tarefa em atraso",
        reason: `Vencida há ${days} dia${days > 1 ? "s" : ""}`,
        cta: "Concluir agora",
        link: "/activities",
      });
    }

    for (const d of deals) {
      const updatedDays = Math.floor((now - new Date(d.updated_at).getTime()) / 86400_000);
      const value = Number(d.value ?? 0);
      const hasRecent = actsByDeal.has(d.id);
      const closeDate = d.expected_close ? new Date(d.expected_close) : null;

      if (closeDate && closeDate.toISOString() <= next14 && closeDate.getTime() >= now - 86400_000) {
        const daysToClose = Math.max(0, Math.floor((closeDate.getTime() - now) / 86400_000));
        actions.push({
          id: `close-${d.id}`,
          kind: "deal_closing_soon",
          priority: KIND_WEIGHT.deal_closing_soon + (value >= 50_000 ? 8 : 0),
          title: d.title,
          reason: `Previsão de fechamento em ${daysToClose} dia${daysToClose !== 1 ? "s" : ""} · ${value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}`,
          cta: "Acelerar fechamento",
          link: "/pipeline",
          meta: { value },
        });
      }

      if (value >= 50_000 && !hasRecent) {
        actions.push({
          id: `high-${d.id}`,
          kind: "deal_high_value",
          priority: KIND_WEIGHT.deal_high_value + Math.min(15, Math.floor(value / 20_000)),
          title: d.title,
          reason: `Alto valor (${value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}) sem contato em 14 dias`,
          cta: "Avançar etapa",
          link: "/pipeline",
        });
      }

      if (updatedDays >= 14 && !hasRecent) {
        actions.push({
          id: `stalled-${d.id}`,
          kind: "deal_stalled",
          priority: KIND_WEIGHT.deal_stalled + Math.min(20, updatedDays - 14),
          title: d.title,
          reason: `Parado há ${updatedDays} dias na etapa ${d.stage}`,
          cta: "Reengajar",
          link: "/pipeline",
        });
      }
    }

    // Hot leads (contatos com deals abertos altos sem atividade recente)
    const contactsAtRisk = new Map<string, number>();
    for (const d of deals) {
      if (!d.contact_id) continue;
      const v = Number(d.value ?? 0);
      if (v <= 0) continue;
      contactsAtRisk.set(d.contact_id, (contactsAtRisk.get(d.contact_id) ?? 0) + v);
    }

    const contactIds = Array.from(contactsAtRisk.keys()).slice(0, 100);
    if (contactIds.length) {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, email")
        .in("id", contactIds);
      for (const c of (contacts ?? []) as Array<{ id: string; name: string; email: string | null }>) {
        const last = actsByContact.get(c.id);
        const lastDays = last ? Math.floor((now - new Date(last).getTime()) / 86400_000) : 999;
        if (lastDays < 7) continue;
        const pipeline = contactsAtRisk.get(c.id) ?? 0;
        if (pipeline < 20_000) continue;
        actions.push({
          id: `hot-${c.id}`,
          kind: "hot_lead_no_contact",
          priority: KIND_WEIGHT.hot_lead_no_contact + Math.min(15, Math.floor(pipeline / 30_000)),
          title: c.name,
          reason: `${pipeline.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })} em pipeline · sem contato há ${lastDays === 999 ? "muito tempo" : `${lastDays} dias`}`,
          cta: "Ligar / enviar email",
          link: `/contacts/${c.id}`,
        });
      }
    }

    // No activity at all in the last 7 days for any deal
    if (!recentActs.some((a: any) => new Date(a.created_at).toISOString() >= sevenDaysAgo)) {
      actions.push({
        id: "no-acts-7d",
        kind: "no_activity_week",
        priority: KIND_WEIGHT.no_activity_week,
        title: "Sua semana está sem atividades registradas",
        reason: "Sem nenhuma ligação, email ou reunião nos últimos 7 dias",
        cta: "Registrar atividade",
        link: "/activities",
      });
    }

    actions.sort((a, b) => b.priority - a.priority);

    const summary = {
      total: actions.length,
      overdue: actions.filter((a) => a.kind === "overdue_task").length,
      closingSoon: actions.filter((a) => a.kind === "deal_closing_soon").length,
      stalled: actions.filter((a) => a.kind === "deal_stalled").length,
      hotLeads: actions.filter((a) => a.kind === "hot_lead_no_contact").length,
      highValue: actions.filter((a) => a.kind === "deal_high_value").length,
    };

    return { actions: actions.slice(0, 50), summary };
  });
