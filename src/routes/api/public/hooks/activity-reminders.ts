import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cron endpoint: creates notifications for activities due in the next hour
// or already overdue. Idempotent per (activity_id, user_id) via dedup check.
export const Route = createFileRoute("/api/public/hooks/activity-reminders")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const now = new Date();
          const horizon = new Date(now.getTime() + 60 * 60 * 1000); // +1h

          const { data: activities, error } = await supabaseAdmin
            .from("activities")
            .select("id, organization_id, user_id, title, due_date, completed")
            .eq("completed", false)
            .not("due_date", "is", null)
            .lte("due_date", horizon.toISOString());

          if (error) throw error;

          let created = 0;
          for (const a of activities ?? []) {
            // dedup: don't insert if a reminder for this activity exists in last 24h
            const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            const { data: existing } = await supabaseAdmin
              .from("notifications")
              .select("id")
              .eq("user_id", a.user_id)
              .eq("type", "activity_reminder")
              .gte("created_at", cutoff)
              .like("body", `%${a.id}%`)
              .maybeSingle();
            if (existing) continue;

            const due = new Date(a.due_date as string);
            const overdue = due.getTime() < now.getTime();
            await supabaseAdmin.from("notifications").insert({
              organization_id: a.organization_id,
              user_id: a.user_id,
              type: "activity_reminder",
              title: overdue ? `Atividade atrasada: ${a.title}` : `Atividade em breve: ${a.title}`,
              body: `Vence em ${due.toLocaleString("pt-BR")} · ref:${a.id}`,
              link: "/activities",
            });
            created++;
          }

          return new Response(JSON.stringify({ ok: true, scanned: activities?.length ?? 0, created }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
