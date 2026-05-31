import { createStart, createMiddleware } from "@tanstack/react-start";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Hard cap on request body size to mitigate DoS via huge payloads.
// 1 MB is generous for JSON RPCs; raise per-endpoint if a feature truly needs more.
const MAX_BODY_BYTES = 1_000_000;

const bodySizeLimitMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    // Only inspect requests that can carry a body
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      const contentLength = request.headers.get("content-length");
      if (contentLength) {
        const len = Number(contentLength);
        if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
          return new Response("Payload Too Large", { status: 413 });
        }
      }
    }
    return next();
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, bodySizeLimitMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
