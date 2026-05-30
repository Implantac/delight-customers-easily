import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Survey = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  type: "nps" | "csat" | "ces" | "custom";
  question: string;
  scale_min: number;
  scale_max: number;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type SurveyResponse = {
  id: string;
  organization_id: string;
  survey_id: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  score: number;
  comment: string | null;
  respondent_email: string | null;
  respondent_name: string | null;
  source: string | null;
  responded_at: string;
  created_at: string;
};

export const listSurveys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ organization_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: surveys, error } = await supabase
      .from("surveys")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: responses, error: rErr } = await supabase
      .from("survey_responses")
      .select("*")
      .eq("organization_id", data.organization_id)
      .order("responded_at", { ascending: false })
      .limit(1000);
    if (rErr) throw new Error(rErr.message);

    // Build per-survey stats
    const stats: Record<string, { count: number; avg: number; nps: number | null; promoters: number; passives: number; detractors: number }> = {};
    for (const s of (surveys ?? []) as Survey[]) {
      const rs = (responses ?? []).filter((r) => r.survey_id === s.id);
      const count = rs.length;
      const sum = rs.reduce((a, r) => a + Number(r.score || 0), 0);
      const avg = count ? sum / count : 0;
      let promoters = 0, passives = 0, detractors = 0;
      if (s.type === "nps") {
        for (const r of rs) {
          const v = Number(r.score);
          if (v >= 9) promoters++;
          else if (v >= 7) passives++;
          else detractors++;
        }
      }
      const nps = s.type === "nps" && count ? Math.round(((promoters - detractors) / count) * 100) : null;
      stats[s.id] = { count, avg, nps, promoters, passives, detractors };
    }

    return {
      surveys: (surveys ?? []) as Survey[],
      responses: (responses ?? []) as SurveyResponse[],
      stats,
    };
  });

export const upsertSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        id: z.string().uuid().optional(),
        organization_id: z.string().uuid(),
        name: z.string().min(1).max(200),
        description: z.string().max(2000).nullable().optional(),
        type: z.enum(["nps", "csat", "ces", "custom"]),
        question: z.string().min(1).max(500),
        scale_min: z.number().int().min(0).max(10),
        scale_max: z.number().int().min(1).max(10),
        active: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: any = { ...data };
    if (!payload.id) payload.created_by = userId;
    const { data: row, error } = await supabase
      .from("surveys")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("surveys").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        organization_id: z.string().uuid(),
        survey_id: z.string().uuid(),
        score: z.number().int().min(0).max(10),
        comment: z.string().max(2000).nullable().optional(),
        respondent_email: z.string().email().max(255).nullable().optional(),
        respondent_name: z.string().max(200).nullable().optional(),
        contact_id: z.string().uuid().nullable().optional(),
        company_id: z.string().uuid().nullable().optional(),
        deal_id: z.string().uuid().nullable().optional(),
        source: z.string().max(100).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("survey_responses")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("survey_responses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
