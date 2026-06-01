import { describe, it, expect } from "vitest";
import { roleAtLeast, roleLabel, type OrgRole } from "@/lib/permissions";

describe("permissions.roleAtLeast", () => {
  it("respects hierarchy owner > admin > manager > sales_rep > member", () => {
    expect(roleAtLeast("owner", "admin")).toBe(true);
    expect(roleAtLeast("admin", "manager")).toBe(true);
    expect(roleAtLeast("manager", "sales_rep")).toBe(true);
    expect(roleAtLeast("sales_rep", "member")).toBe(true);
  });

  it("returns false for insufficient roles", () => {
    expect(roleAtLeast("member", "sales_rep")).toBe(false);
    expect(roleAtLeast("sales_rep", "manager")).toBe(false);
    expect(roleAtLeast("manager", "admin")).toBe(false);
    expect(roleAtLeast("admin", "owner")).toBe(false);
  });

  it("returns false when role is null/undefined", () => {
    expect(roleAtLeast(null, "member")).toBe(false);
    expect(roleAtLeast(undefined, "member")).toBe(false);
  });

  it("labels each role in Portuguese", () => {
    const roles: OrgRole[] = ["owner", "admin", "manager", "sales_rep", "member"];
    for (const r of roles) expect(roleLabel(r)).not.toBe("—");
    expect(roleLabel(null)).toBe("—");
  });
});
