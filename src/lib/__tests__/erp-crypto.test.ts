import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  // 32-byte base64 key for AES-256-GCM
  if (!process.env.ERP_CREDENTIALS_KEY) {
    process.env.ERP_CREDENTIALS_KEY = Buffer.alloc(32, 7).toString("base64");
  }
});

describe("erp-crypto", () => {
  it("encrypt/decrypt round-trip preserves payload", async () => {
    const { encryptCredentials, decryptCredentials } = await import("@/lib/erp-crypto.server");
    const sample = { app_key: "token-xyz", app_secret: "s3cret", note: "ção" };
    const blob = encryptCredentials(sample);
    expect(typeof blob).toBe("string");
    expect(blob.length).toBeGreaterThan(20);
    const back = decryptCredentials<typeof sample>(blob);
    expect(back).toEqual(sample);
  });

  it("produces different ciphertext for same input (random IV)", async () => {
    const { encryptCredentials } = await import("@/lib/erp-crypto.server");
    const a = encryptCredentials({ x: "1" });
    const b = encryptCredentials({ x: "1" });
    expect(a).not.toBe(b);
  });
});
