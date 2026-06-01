import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, withTiming } from "@/lib/logger.server";

describe("logger", () => {
  let logs: string[] = [];
  let errs: string[] = [];
  let warns: string[] = [];
  let origLog: typeof console.log;
  let origErr: typeof console.error;
  let origWarn: typeof console.warn;

  beforeEach(() => {
    logs = []; errs = []; warns = [];
    origLog = console.log; origErr = console.error; origWarn = console.warn;
    console.log = ((s: string) => { logs.push(s); }) as any;
    console.error = ((s: string) => { errs.push(s); }) as any;
    console.warn = ((s: string) => { warns.push(s); }) as any;
  });
  afterEach(() => {
    console.log = origLog; console.error = origErr; console.warn = origWarn;
  });

  it("emits structured JSON with level + msg + ctx", () => {
    logger.info("hello", { org_id: "abc" });
    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(logs[0]);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello");
    expect(parsed.org_id).toBe("abc");
    expect(typeof parsed.ts).toBe("string");
  });

  it("routes errors to console.error with serialized error fields", () => {
    logger.error("boom", { route: "x" }, new Error("nope"));
    expect(errs).toHaveLength(1);
    const p = JSON.parse(errs[0]);
    expect(p.error_name).toBe("Error");
    expect(p.error_message).toBe("nope");
    expect(typeof p.error_stack).toBe("string");
  });

  it("withTiming logs ok=true and returns value", async () => {
    const v = await withTiming("op", { org_id: "o1" }, async () => 42);
    expect(v).toBe(42);
    const p = JSON.parse(logs[0]);
    expect(p.ok).toBe(true);
    expect(typeof p.duration_ms).toBe("number");
  });

  it("withTiming logs ok=false on throw and rethrows", async () => {
    await expect(
      withTiming("op", {}, async () => { throw new Error("x"); }),
    ).rejects.toThrow("x");
    const p = JSON.parse(errs[0]);
    expect(p.ok).toBe(false);
  });
});
