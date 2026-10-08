import { describe, expect, it } from "vitest";
import { rlsExemptCode, rlsProblem, type RlsFacts } from "@/lib/rls-guard";

const ok: RlsFacts = { role: "bibliotek_app", super: false, bypass: false, owns: false, rls_on: true, forced: false };

describe("rlsProblem", () => {
  it("accepts a plain, non-owner role with RLS enabled", () => expect(rlsProblem(ok)).toBeNull());
  it("rejects every way a role can be exempt from Row-Level Security", () => {
    expect(rlsProblem({ ...ok, super: true })).toContain("superuser");
    expect(rlsProblem({ ...ok, bypass: true })).toContain("BYPASSRLS");
    expect(rlsProblem({ ...ok, owns: true })).toContain("owns the tables");
    expect(rlsProblem({ ...ok, rls_on: false })).toContain("not enabled");
  });
  it("accepts an owner only when FORCE ROW LEVEL SECURITY applies to owners", () => {
    expect(rlsProblem({ ...ok, owns: true, forced: true })).toBeNull();
  });
});

describe("rlsExemptCode names the specific reason", () => {
  it("maps each cause to its own code, and null when restricted", () => {
    expect(rlsExemptCode(ok)).toBeNull();
    expect(rlsExemptCode({ ...ok, super: true })).toBe("RLS_SUPERUSER");
    expect(rlsExemptCode({ ...ok, bypass: true })).toBe("RLS_BYPASSRLS");
    expect(rlsExemptCode({ ...ok, owns: true })).toBe("RLS_OWNER");
    expect(rlsExemptCode({ ...ok, rls_on: false })).toBe("RLS_DISABLED");
  });
  it("owner status via role membership is described as such", () => {
    expect(rlsProblem({ ...ok, owns: true })).toContain("member of the role that does");
  });
});
