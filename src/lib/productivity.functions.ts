import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  organization_id: z.string().uuid(),
  days: z.number().int().min(7).max(180).default(30),
});

export const getProductivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = Date.now();
    const since = new Date(now - data.days * 86400_000).toISOString();

    const [actsRes, dealsRes, membersRes] = await Promise.all([
      supabase
        .from("activities")
        .select("id, user_id, type, completed, created_at, due_date, updated_at")
        .eq("organization_id", data.organization_id)
        .gte("created_at", since),
      supabase
        .from("deals")
        .select("user_id, stage, value, closed_at, created_at")
        .eq("organization_id", data.organization_id)
        .gte("updated_at", since),
      supabase
        .from("memberships")
        .select("user_id, role")
        .eq("organization_id", data.organization_id),
    ]);

    const acts = actsRes.data ?? [];
    const deals = dealsRes.data ?? [];
    const members = membersRes.data ?? [];

    const userIds = Array.from(new Set(members.map((m: any) => m.user_id)));
    const profiles: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      for (const p of profs ?? []) profiles[(p as any).id] = (p as any).full_name ?? "—";
    }

    const rows = userIds.map((uid) => {
      const role = (members.find((m: any) => m.user_id === uid) as any)?.role ?? "member";
      const myActs = acts.filter((a: any) => a.user_id === uid);
      const completed = myActs.filter((a: any) => a.completed);
      const overdue = myActs.filter((a: any) => !a.completed && a.due_date && new Date(a.due_date).getTime() < now);
      const completionRate = myActs.length ? completed.length / myActs.length : 0;

      // Avg response time = days from creation to completion (when completed)
      const respDays = completed
        .filter((a: any) => a.updated_at && a.created_at)
        .map((a: any) => (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / 86400_000);
      const avgRespDays = respDays.length ? respDays.reduce((a, b) => a + b, 0) / respDays.length : 0;

      const myDeals = deals.filter((d: any) => d.user_id === uid);
      const won = myDeals.filter((d: any) => d.stage === "won");
      const lost = myDeals.filter((d: any) => d.stage === "lost");
      const wonValue = won.reduce((s: number, d: any) => s + Number(d.value || 0), 0);

      // Productivity score (0-100): balance of activity, completion, low overdue, response speed
      const actScore = Math.min(40, myActs.length); // up to 40 pts for activities
      const completionScore = completionRate * 30; // up to 30 pts
      const overdueScore = Math.max(0, 15 - overdue.length * 2); // up to 15 pts
      const respScore = avgRespDays > 0 ? Math.max(0, 15 - avgRespDays) : 15; // up to 15 pts
      const score = Math.round(actScore + completionScore + overdueScore + respScore);

      return {
        user_id: uid,
        name: profiles[uid] ?? "—",
        role,
        score,
        activities: myActs.length,
        completed: completed.length,
        completionRate,
        overdue: overdue.length,
        avgRespDays: Math.round(avgRespDays * 10) / 10,
        wonDeals: won.length,
        wonValue,
        lostDeals: lost.length,
      };
    }).sort((a, b) => b.score - a.score);

    const totals = {
      activities: acts.length,
      completed: acts.filter((a: any) => a.completed).length,
      overdue: acts.filter((a: any) => !a.completed && a.due_date && new Date(a.due_date).getTime() < now).length,
      members: rows.length,
    };

    // Daily activity heatmap (last N days)
    const buckets: Record<string, number> = {};
    for (let i = 0; i < data.days; i++) {
      const d = new Date(now - i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = 0;
    }
    for (const a of acts) {
      const key = (a.created_at as string).slice(0, 10);
      if (key in buckets) buckets[key]++;
    }
    const heatmap = Object.entries(buckets)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { rows, totals, heatmap };
  });
