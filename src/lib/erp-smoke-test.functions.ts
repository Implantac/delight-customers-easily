/**
 * Smoke test do Connect Universal — valida o fluxo end-to-end sem
 * precisar de credenciais reais de ERP:
 *   1. Cripto (encrypt/decrypt round-trip)
 *   2. Registry de drivers (todos resolvíveis)
 *   3. Capacidade de pushCustomer por driver
 *   4. Acesso à fila outbox (RLS + grants)
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SmokeCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

export type SmokeReport = {
  ok: boolean;
  checks: SmokeCheck[];
  ran_at: string;
};

export const runErpSmokeTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SmokeReport> => {
    const checks: SmokeCheck[] = [];

    // 1. Cripto round-trip
    try {
      const { encryptCredentials, decryptCredentials } = await import("./erp-crypto.server");
      const sample = { app_key: "token-xyz", app_secret: "secret-abc", note: "smoke" };
      const enc = encryptCredentials(sample);
      const dec = decryptCredentials<typeof sample>(enc);
      const ok = dec.app_key === sample.app_key && dec.app_secret === sample.app_secret;
      checks.push({
        name: "Criptografia AES-256-GCM",
        ok,
        detail: ok
          ? `Round-trip OK (blob ${enc.length} chars).`
          : "Decrypt retornou payload diferente.",
      });
    } catch (e: any) {
      checks.push({
        name: "Criptografia AES-256-GCM",
        ok: false,
        detail: `Falha: ${e?.message ?? String(e)}. Verifique ERP_CREDENTIALS_KEY.`,
      });
    }

    // 2. Registry + capabilities
    try {
      const { listImplementedDrivers, getDriver, DRIVER_CAPABILITIES } = await import(
        "./erp-drivers/index"
      );
      const keys = listImplementedDrivers();
      const broken = keys.filter((k) => {
        try { getDriver(k); return false; } catch { return true; }
      });
      checks.push({
        name: "Registry de drivers",
        ok: broken.length === 0,
        detail: broken.length
          ? `Drivers quebrados: ${broken.join(", ")}`
          : `${keys.length} drivers registrados: ${keys.join(", ")}.`,
      });

      // 3. pushCustomer por driver
      const push = keys.map((k) => {
        const d = getDriver(k);
        const cap = DRIVER_CAPABILITIES[k];
        return `${k}=${typeof d.pushCustomer === "function" ? "✓" : "✗"} (${cap.mode})`;
      });
      const supportsAny = keys.some((k) => typeof getDriver(k).pushCustomer === "function");
      checks.push({
        name: "Push CRM→ERP (pushCustomer)",
        ok: supportsAny,
        detail: push.join("  "),
      });
    } catch (e: any) {
      checks.push({
        name: "Registry de drivers",
        ok: false,
        detail: `Falha: ${e?.message ?? String(e)}`,
      });
    }

    // 4. Fila outbox (RLS + grants)
    try {
      const { supabase } = context;
      const { error, count } = await supabase
        .from("erp_outbox")
        .select("id", { count: "exact", head: true });
      checks.push({
        name: "Acesso à fila erp_outbox",
        ok: !error,
        detail: error ? `Falha: ${error.message}` : `Acesso OK. ${count ?? 0} jobs visíveis.`,
      });
    } catch (e: any) {
      checks.push({
        name: "Acesso à fila erp_outbox",
        ok: false,
        detail: `Falha: ${e?.message ?? String(e)}`,
      });
    }

    return {
      ok: checks.every((c) => c.ok),
      checks,
      ran_at: new Date().toISOString(),
    };
  });
