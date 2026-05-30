import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listRoutingRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rules, error } = await supabase
      .from("lead_routing_rules")
      .select("*, lead_routing_assignees(*)")
      .eq("organization_id", data.organization_id)
      .order("priority", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);

    const { data: log } = await supabase
      .from("lead_routing_log")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(100);

    return {
      rules: (rules ?? []).map((r: any) => ({
        ...r,
        assignees: (r.lead_routing_assignees ?? []).sort((a: any, b: any) => a.position - b.position),
      })),
      log: log ?? [],
    };
  });

export const upsertRoutingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    name: string;
    description?: string | null;
    strategy: "round_robin" | "weighted" | "first_available" | "manual";
    priority: number;
    active: boolean;
    match_source?: string | null;
    match_territory_id?: string | null;
    match_min_value?: number | null;
    match_max_value?: number | null;
    match_tags?: string[] | null;
    assignees: { user_id: string; weight: number }[];
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      organization_id: data.organization_id,
      name: data.name,
      description: data.description ?? null,
      strategy: data.strategy,
      priority: data.priority,
      active: data.active,
      match_source: data.match_source ?? null,
      match_territory_id: data.match_territory_id ?? null,
      match_min_value: data.match_min_value ?? null,
      match_max_value: data.match_max_value ?? null,
      match_tags: data.match_tags && data.match_tags.length ? data.match_tags : null,
    };
    let id = data.id;
    if (id) {
      const { error } = await supabase.from("lead_routing_rules").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      await supabase.from("lead_routing_assignees").delete().eq("rule_id", id);
    } else {
      const { data: r, error } = await supabase
        .from("lead_routing_rules")
        .insert({ ...payload, created_by: userId })
        .select("id").single();
      if (error) throw new Error(error.message);
      id = r.id;
    }
    if (data.assignees.length) {
      const { error } = await supabase.from("lead_routing_assignees").insert(
        data.assignees.map((a, i) => ({
          organization_id: data.organization_id,
          rule_id: id!,
          user_id: a.user_id,
          weight: Math.max(1, a.weight || 1),
          position: i,
        }))
      );
      if (error) throw new Error(error.message);
    }
    return { id };
  });

export const deleteRoutingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lead_routing_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const routeLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    lead_type: "deal" | "contact" | "company";
    lead_id: string;
    source?: string | null;
    territory_id?: string | null;
    value?: number | null;
    tags?: string[] | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rules, error } = await supabase
      .from("lead_routing_rules")
      .select("*, lead_routing_assignees(*)")
      .eq("organization_id", data.organization_id)
      .eq("active", true)
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);

    const matched = (rules ?? []).find((r: any) => {
      if (r.match_source && r.match_source !== data.source) return false;
      if (r.match_territory_id && r.match_territory_id !== data.territory_id) return false;
      if (r.match_min_value !== null && (data.value ?? 0) < Number(r.match_min_value)) return false;
      if (r.match_max_value !== null && (data.value ?? 0) > Number(r.match_max_value)) return false;
      if (r.match_tags && r.match_tags.length) {
        const tags = data.tags ?? [];
        if (!r.match_tags.some((t: string) => tags.includes(t))) return false;
      }
      return (r.lead_routing_assignees ?? []).length > 0;
    });

    if (!matched) {
      await supabase.from("lead_routing_log").insert({
        organization_id: data.organization_id,
        rule_id: null, lead_type: data.lead_type, lead_id: data.lead_id,
        assigned_to: null, reason: "Nenhuma regra correspondente",
      });
      return { assigned_to: null, rule_id: null };
    }

    const assignees = matched.lead_routing_assignees.sort((a: any, b: any) => a.position - b.position);
    let pick: any;
    if (matched.strategy === "round_robin") {
      const idx = matched.rr_cursor % assignees.length;
      pick = assignees[idx];
      await supabase.from("lead_routing_rules")
        .update({ rr_cursor: (matched.rr_cursor + 1) % Math.max(1, assignees.length) })
        .eq("id", matched.id);
    } else if (matched.strategy === "weighted") {
      const total = assignees.reduce((s: number, a: any) => s + (a.weight || 1), 0);
      let r = Math.random() * total;
      pick = assignees[0];
      for (const a of assignees) { r -= (a.weight || 1); if (r <= 0) { pick = a; break; } }
    } else {
      pick = assignees[0];
    }

    // Apply ownership to the underlying entity when supported
    const tableMap: Record<string, string> = { deal: "deals", contact: "contacts", company: "companies" };
    const table = tableMap[data.lead_type];
    if (table) {
      await supabase.from(table).update({ owner_id: pick.user_id }).eq("id", data.lead_id);
    }

    await supabase.from("lead_routing_log").insert({
      organization_id: data.organization_id,
      rule_id: matched.id,
      lead_type: data.lead_type,
      lead_id: data.lead_id,
      assigned_to: pick.user_id,
      reason: `${matched.name} (${matched.strategy})`,
    });

    return { assigned_to: pick.user_id, rule_id: matched.id };
  });
