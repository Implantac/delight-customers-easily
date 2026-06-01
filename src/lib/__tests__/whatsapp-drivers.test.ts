import { describe, it, expect } from "vitest";
import { getDriver, type WAChannelConfig } from "@/lib/whatsapp-drivers.server";

const baseChannel = (provider: WAChannelConfig["provider"]): WAChannelConfig => ({
  id: "ch-1",
  organization_id: "org-1",
  provider,
});

describe("whatsapp-drivers registry", () => {
  it("resolve all 4 providers", () => {
    for (const p of ["meta_waba", "evolution", "uazapi", "twilio"] as const) {
      const d = getDriver(p);
      expect(typeof d.sendText).toBe("function");
      expect(typeof d.parseInbound).toBe("function");
      expect(typeof d.verifySignature).toBe("function");
    }
  });

  it("sendText fails fast without credentials (non-retriable)", async () => {
    const r = await getDriver("meta_waba").sendText(baseChannel("meta_waba"), "5511999", "oi");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retriable).toBe(false);
  });

  it("parses Meta inbound payload into normalized messages", () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: "wamid.123", from: "5511999", type: "text",
              text: { body: "olá mundo" }, timestamp: "1700000000",
            }],
          },
        }],
      }],
    };
    const out = getDriver("meta_waba").parseInbound(payload, baseChannel("meta_waba"));
    expect(out).toHaveLength(1);
    expect(out[0].body).toBe("olá mundo");
    expect(out[0].from_phone).toBe("5511999");
    expect(out[0].type).toBe("text");
  });

  it("returns [] on malformed payloads instead of throwing", () => {
    expect(getDriver("meta_waba").parseInbound({}, baseChannel("meta_waba"))).toEqual([]);
    expect(getDriver("evolution").parseInbound(null, baseChannel("evolution"))).toEqual([]);
    expect(getDriver("uazapi").parseInbound("nope", baseChannel("uazapi"))).toEqual([]);
    expect(getDriver("twilio").parseInbound(undefined, baseChannel("twilio"))).toEqual([]);
  });
});
