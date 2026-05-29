import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHmac } from "crypto";

const input = z.object({
  organization_id: z.string().uuid(),
  event: z.string().min(1).max(64),
  payload: z.record(z.string(), z.any()),
});

export const triggerWebhooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // RLS ensures the caller is a member of this org
    const { data: hooks, error } = await supabase
      .from("webhooks")
      .select("id, url, events, secret, enabled")
      .eq("organization_id", data.organization_id)
      .eq("enabled", true);
    if (error) throw new Error(error.message);

    const matching = (hooks ?? []).filter((h) =>
      (h.events ?? []).includes(data.event) || (h.events ?? []).includes("*"),
    );
    if (matching.length === 0) return { delivered: 0 };

    const body = JSON.stringify({
      event: data.event,
      organization_id: data.organization_id,
      sent_at: new Date().toISOString(),
      data: data.payload,
    });

    const results = await Promise.allSettled(
      matching.map(async (h) => {
        const sig = createHmac("sha256", h.secret).update(body).digest("hex");
        const res = await fetch(h.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Lovable-Event": data.event,
            "X-Lovable-Signature": `sha256=${sig}`,
          },
          body,
          // Don't block the user if endpoint is slow
          signal: AbortSignal.timeout(8000),
        });
        return res.ok;
      }),
    );

    return {
      delivered: results.filter((r) => r.status === "fulfilled" && r.value).length,
      attempted: matching.length,
    };
  });
