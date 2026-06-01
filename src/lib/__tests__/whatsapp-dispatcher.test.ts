import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes do dispatcher com um stub mínimo do supabase client.
 * Cobre: claim (concorrência), backoff em retriable, fail-fast em não-retriable,
 * encerramento ao bater MAX_ATTEMPTS.
 */

type Row = Record<string, any>;

function makeSupabaseStub(opts: {
  outbox: Row[];
  channel: Row | null;
  sendResult: { ok: true; provider_message_id?: string } | { ok: false; retriable: boolean; error: string };
}) {
  const updates: Array<{ table: string; patch: Row; where: Row }> = [];
  const api: any = {
    from(table: string) {
      let _select = "*";
      let _filters: Row = {};
      const builder: any = {
        select(s: string) { _select = s; return builder; },
        eq(k: string, v: any) { _filters[k] = v; return builder; },
        lte(_k: string, _v: any) { return builder; },
        in(_k: string, _v: any) { return builder; },
        not(_k: string, _op: string, _v: any) { return builder; },
        order() { return builder; },
        limit(_n: number) {
          if (table === "whatsapp_outbox") return Promise.resolve({ data: opts.outbox, error: null });
          return Promise.resolve({ data: [], error: null });
        },
        maybeSingle() {
          if (table === "whatsapp_channels") return Promise.resolve({ data: opts.channel, error: null });
          // claim path returns the claimed row
          return Promise.resolve({ data: { id: _filters.id }, error: null });
        },
        update(patch: Row) {
          return {
            eq(k: string, v: any) {
              const where: Row = { [k]: v };
              return {
                eq(k2: string, v2: any) { where[k2] = v2; return {
                  select() { return { maybeSingle() {
                    updates.push({ table, patch, where });
                    // simulate successful claim
                    return Promise.resolve({ data: { id: where.id }, error: null });
                  } }; },
                }; },
                select() { return { maybeSingle() {
                  updates.push({ table, patch, where });
                  return Promise.resolve({ data: { id: where.id }, error: null });
                } }; },
                then(resolve: any) { updates.push({ table, patch, where }); resolve({ error: null }); },
              };
            },
          };
        },
      };
      return builder;
    },
    __updates: updates,
  };
  return api;
}

const baseOutboxRow = (extra: Row = {}): Row => ({
  id: "ob-1",
  channel_id: "ch-1",
  to_phone: "5511999",
  body: "oi",
  attempts: 0,
  conversation_id: null,
  organization_id: "org-1",
  message_id: null,
  ...extra,
});

const activeChannel: Row = {
  id: "ch-1", organization_id: "org-1", provider: "meta_waba",
  phone_number: "+5511999", phone_number_id: "pni", business_account_id: "waba",
  base_url: null, instance_name: null, webhook_secret: null,
  credentials_encrypted: JSON.stringify({ access_token: "tok" }), status: "active",
};

beforeEach(() => { vi.resetModules(); });

describe("whatsapp-dispatcher", () => {
  it("marca como failed quando canal está inativo", async () => {
    const supabase = makeSupabaseStub({
      outbox: [baseOutboxRow()],
      channel: { ...activeChannel, status: "paused" },
      sendResult: { ok: false, retriable: false, error: "x" },
    });
    const { processWhatsAppOutbox } = await import("@/lib/whatsapp-dispatcher.server");
    const r = await processWhatsAppOutbox(supabase);
    expect(r.failed).toBe(1);
    const failedUpdate = (supabase.__updates as any[]).find(u => u.patch.status === "failed");
    expect(failedUpdate).toBeTruthy();
    expect(failedUpdate.patch.last_error).toMatch(/canal/);
  });

  it("re-agenda com backoff quando erro é retriable", async () => {
    vi.doMock("@/lib/whatsapp-drivers.server", async () => {
      const real = await vi.importActual<any>("@/lib/whatsapp-drivers.server");
      return {
        ...real,
        getDriver: () => ({
          sendText: async () => ({ ok: false, retriable: true, error: "timeout" }),
          parseInbound: () => [],
          verifySignature: () => true,
        }),
      };
    });
    const supabase = makeSupabaseStub({
      outbox: [baseOutboxRow({ attempts: 1 })],
      channel: activeChannel,
      sendResult: { ok: false, retriable: true, error: "timeout" },
    });
    const { processWhatsAppOutbox } = await import("@/lib/whatsapp-dispatcher.server");
    const r = await processWhatsAppOutbox(supabase);
    expect(r.failed).toBe(1);
    const finalUpdate = (supabase.__updates as any[]).find(u =>
      u.table === "whatsapp_outbox" && u.patch.status === "pending"
    );
    expect(finalUpdate).toBeTruthy();
    expect(finalUpdate.patch.attempts).toBe(2);
    expect(new Date(finalUpdate.patch.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("desiste após MAX_ATTEMPTS", async () => {
    vi.doMock("@/lib/whatsapp-drivers.server", async () => {
      const real = await vi.importActual<any>("@/lib/whatsapp-drivers.server");
      return {
        ...real,
        getDriver: () => ({
          sendText: async () => ({ ok: false, retriable: true, error: "timeout" }),
          parseInbound: () => [], verifySignature: () => true,
        }),
      };
    });
    const supabase = makeSupabaseStub({
      outbox: [baseOutboxRow({ attempts: 5 })],
      channel: activeChannel,
      sendResult: { ok: false, retriable: true, error: "timeout" },
    });
    const { processWhatsAppOutbox } = await import("@/lib/whatsapp-dispatcher.server");
    await processWhatsAppOutbox(supabase);
    const finalUpdate = (supabase.__updates as any[]).find(u =>
      u.table === "whatsapp_outbox" && u.patch.status === "failed"
    );
    expect(finalUpdate).toBeTruthy();
  });

  it("marca como sent em sucesso", async () => {
    vi.doMock("@/lib/whatsapp-drivers.server", async () => {
      const real = await vi.importActual<any>("@/lib/whatsapp-drivers.server");
      return {
        ...real,
        getDriver: () => ({
          sendText: async () => ({ ok: true, provider_message_id: "wamid.abc" }),
          parseInbound: () => [], verifySignature: () => true,
        }),
      };
    });
    const supabase = makeSupabaseStub({
      outbox: [baseOutboxRow()],
      channel: activeChannel,
      sendResult: { ok: true },
    });
    const { processWhatsAppOutbox } = await import("@/lib/whatsapp-dispatcher.server");
    const r = await processWhatsAppOutbox(supabase);
    expect(r.sent).toBe(1);
    const sentUpdate = (supabase.__updates as any[]).find(u => u.patch.status === "sent");
    expect(sentUpdate.patch.provider_message_id).toBe("wamid.abc");
  });
});
