import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function npsMetrics(rows: any[]) {
  const total = rows.length;
  if (!total) return { total: 0, promoters: 0, passives: 0, detractors: 0, nps: 0, avg: 0 };
  const promoters = rows.filter((r) => r.score >= 9).length;
  const passives = rows.filter((r) => r.score >= 7 && r.score <= 8).length;
  const detractors = rows.filter((r) => r.score <= 6).length;
  const avg = rows.reduce((s, r) => s + Number(r.score || 0), 0) / total;
  const nps = Math.round(((promoters - detractors) / total) * 100);
  return { total, promoters, passives, detractors, nps, avg: Math.round(avg * 10) / 10 };
}

export const listSurveys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organization_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: surveys, error } = await supabase
      .from("surveys")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: responses } = await supabase
      .from("survey_responses")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("responded_at", { ascending: false })
      .limit(1000);
    const rList = responses ?? [];
    const overall = npsMetrics(rList);
    const bySurvey: Record<string, any> = {};
    for (const s of surveys ?? []) {
      bySurvey[s.id] = npsMetrics(rList.filter((r: any) => r.survey_id === s.id));
    }
    return { surveys: surveys ?? [], responses: rList, overall, bySurvey };
  });

export const upsertSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    organization_id: string;
    name: string;
    description?: string | null;
    type?: string;
    question?: string;
    active?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = {
      organization_id: data.organization_id,
      name: data.name,
      description: data.description ?? null,
      type: data.type ?? "nps",
      question: data.question ?? "O quanto você recomendaria nossa empresa?",
      active: data.active ?? true,
    };
    if (data.id) {
      const { data: row, error } = await supabase.from("surveys").update(payload).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return { survey: row };
    }
    payload.created_by = userId;
    const { data: row, error } = await supabase.from("surveys").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return { survey: row };
  });

export const deleteSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("surveys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organization_id: string;
    survey_id: string;
    score: number;
    comment?: string | null;
    respondent_name?: string | null;
    respondent_email?: string | null;
    source?: string | null;
    contact_id?: string | null;
    company_id?: string | null;
    deal_id?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    if (data.score < 0 || data.score > 10) throw new Error("Score deve estar entre 0 e 10");
    const { data: row, error } = await context.supabase
      .from("survey_responses")
      .insert({
        organization_id: data.organization_id,
        survey_id: data.survey_id,
        score: data.score,
        comment: data.comment ?? null,
        respondent_name: data.respondent_name ?? null,
        respondent_email: data.respondent_email ?? null,
        source: data.source ?? "manual",
        contact_id: data.contact_id ?? null,
        company_id: data.company_id ?? null,
        deal_id: data.deal_id ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { response: row };
  });

export const deleteResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("survey_responses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
