import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const orgIn = z.object({ organization_id: z.string().uuid() });

export const listDashboards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgIn.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("dashboards")
      .select("id, name, description, owner_id, is_shared, updated_at")
      .eq("organization_id", data.organization_id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { dashboards: rows ?? [] };
  });

const createIn = orgIn.extend({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});
export const createDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => createIn.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: out, error } = await supabase
      .from("dashboards")
      .insert({
        organization_id: data.organization_id,
        name: data.name,
        description: data.description ?? null,
        owner_id: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { dashboard: out };
  });

const idIn = z.object({ id: z.string().uuid() });
export const deleteDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idIn.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("dashboards").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idIn.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: dash, error } = await supabase.from("dashboards").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: widgets, error: we } = await supabase
      .from("dashboard_widgets")
      .select("*")
      .eq("dashboard_id", data.id)
      .order("sort_order", { ascending: true });
    if (we) throw new Error(we.message);
    return { dashboard: dash, widgets: widgets ?? [] };
  });

const widgetTypes = z.enum([
  "kpi_won_month", "kpi_pipeline_open", "kpi_deals_count",
  "bar_by_stage", "line_revenue_6m", "funnel_conversion",
  "top_reps", "goal_progress", "recent_activities",
]);

const addWidgetIn = z.object({
  dashboard_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  widget_type: widgetTypes,
  title: z.string().min(1).max(120),
  config: z.record(z.string(), z.any()).optional(),
});
export const addWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => addWidgetIn.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { count } = await supabase
      .from("dashboard_widgets")
      .select("id", { count: "exact", head: true })
      .eq("dashboard_id", data.dashboard_id);
    const { data: out, error } = await supabase
      .from("dashboard_widgets")
      .insert({ ...data, config: data.config ?? {}, sort_order: count ?? 0 })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { widget: out };
  });

export const deleteWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => idIn.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("dashboard_widgets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Executa a query agregada do widget; lê apenas dados da org via RLS. */
const runIn = z.object({ widget_id: z.string().uuid(), organization_id: z.string().uuid() });
export const runWidget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => runIn.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: w, error } = await supabase.from("dashboard_widgets").select("*").eq("id", data.widget_id).single();
    if (error || !w) throw new Error(error?.message ?? "Widget não encontrado");
    const org = data.organization_id;

    switch ((w as any).widget_type) {
      case "kpi_won_month": {
        const startMonth = new Date(); startMonth.setUTCDate(1); startMonth.setUTCHours(0, 0, 0, 0);
        const { data: rows } = await supabase
          .from("deals").select("value").eq("organization_id", org).eq("stage", "won")
          .gte("closed_at", startMonth.toISOString());
        const sum = (rows ?? []).reduce((a: number, r: any) => a + Number(r.value || 0), 0);
        return { value: sum, count: (rows ?? []).length };
      }
      case "kpi_pipeline_open": {
        const { data: rows } = await supabase
          .from("deals").select("value").eq("organization_id", org)
          .not("stage", "in", "(won,lost)");
        const sum = (rows ?? []).reduce((a: number, r: any) => a + Number(r.value || 0), 0);
        return { value: sum, count: (rows ?? []).length };
      }
      case "kpi_deals_count": {
        const { count } = await supabase
          .from("deals").select("id", { count: "exact", head: true })
          .eq("organization_id", org);
        return { value: count ?? 0 };
      }
      case "bar_by_stage": {
        const { data: rows } = await supabase
          .from("deals").select("stage, value").eq("organization_id", org)
          .not("stage", "in", "(won,lost)");
        const agg: Record<string, number> = {};
        for (const r of rows ?? []) agg[(r as any).stage] = (agg[(r as any).stage] ?? 0) + Number((r as any).value || 0);
        return { data: Object.entries(agg).map(([stage, value]) => ({ stage, value })) };
      }
      case "line_revenue_6m": {
        const since = new Date(); since.setUTCMonth(since.getUTCMonth() - 5); since.setUTCDate(1); since.setUTCHours(0, 0, 0, 0);
        const { data: rows } = await supabase
          .from("deals").select("value, closed_at").eq("organization_id", org).eq("stage", "won")
          .gte("closed_at", since.toISOString());
        const buckets: Record<string, number> = {};
        for (let i = 0; i < 6; i++) {
          const d = new Date(since); d.setUTCMonth(d.getUTCMonth() + i);
          buckets[`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`] = 0;
        }
        for (const r of rows ?? []) {
          const dt = new Date((r as any).closed_at);
          const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
          if (buckets[key] !== undefined) buckets[key] += Number((r as any).value || 0);
        }
        return { data: Object.entries(buckets).map(([month, value]) => ({ month, value })) };
      }
      case "funnel_conversion": {
        const { data: rows } = await supabase
          .from("deals").select("stage").eq("organization_id", org);
        const agg: Record<string, number> = {};
        for (const r of rows ?? []) agg[(r as any).stage] = (agg[(r as any).stage] ?? 0) + 1;
        const order = ["lead", "qualified", "proposal", "negotiation", "won"];
        return { data: order.map((s) => ({ stage: s, count: agg[s] ?? 0 })) };
      }
      case "top_reps": {
        const startMonth = new Date(); startMonth.setUTCDate(1); startMonth.setUTCHours(0, 0, 0, 0);
        const { data: rows } = await supabase
          .from("deals").select("user_id, value").eq("organization_id", org).eq("stage", "won")
          .gte("closed_at", startMonth.toISOString());
        const agg = new Map<string, number>();
        for (const r of rows ?? []) {
          if (!(r as any).user_id) continue;
          agg.set((r as any).user_id, (agg.get((r as any).user_id) ?? 0) + Number((r as any).value || 0));
        }
        const ids = Array.from(agg.keys());
        const names: Record<string, string> = {};
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
          for (const p of profs ?? []) names[(p as any).id] = (p as any).full_name ?? "—";
        }
        return {
          data: Array.from(agg.entries())
            .map(([uid, v]) => ({ name: names[uid] ?? "—", value: v }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
        };
      }
      case "goal_progress": {
        const now = new Date();
        const periodDay = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
        const { data: goals } = await supabase
          .from("sales_goals").select("user_id, target_value").eq("organization_id", org).eq("period_month", periodDay);
        const startMonth = new Date(periodDay);
        const { data: deals } = await supabase
          .from("deals").select("user_id, value").eq("organization_id", org).eq("stage", "won")
          .gte("closed_at", startMonth.toISOString());
        const realized = new Map<string, number>();
        for (const d of deals ?? []) {
          if (!(d as any).user_id) continue;
          realized.set((d as any).user_id, (realized.get((d as any).user_id) ?? 0) + Number((d as any).value || 0));
        }
        const totalTarget = (goals ?? []).reduce((a: number, g: any) => a + Number(g.target_value || 0), 0);
        const totalReal = Array.from(realized.values()).reduce((a, v) => a + v, 0);
        return { target: totalTarget, realized: totalReal, attainment: totalTarget > 0 ? totalReal / totalTarget : null };
      }
      case "recent_activities": {
        const { data: rows } = await supabase
          .from("activities").select("id, type, title, created_at, completed")
          .eq("organization_id", org).order("created_at", { ascending: false }).limit(8);
        return { data: rows ?? [] };
      }
    }
    return {};
  });
