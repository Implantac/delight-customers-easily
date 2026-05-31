// Authenticates pg_cron / external scheduler calls to /api/public/hooks/*
// using the Supabase publishable (anon) key in the `apikey` header — the
// canonical pattern documented for Lovable Cloud scheduled jobs.
//
// Returns null when authorized; returns a 401 Response when not.

export function requireCronApiKey(request: Request): Response | null {
  const expected =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  if (!expected) {
    // Fail closed if the server has no expected key configured.
    return new Response(
      JSON.stringify({ error: "server misconfigured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  const provided =
    request.headers.get("apikey") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (provided !== expected) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return null;
}
