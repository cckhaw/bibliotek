import { describe, expect, it, vi } from "vitest";

// Simulate the production mistake: the runtime URL points at the OWNER role.
process.env.DATABASE_URL = process.env.SYSTEM_DATABASE_URL;

import { withTenant } from "@/lib/db";

describe("runtime database role is the table owner (misconfiguration)", () => {
  it("withTenant refuses to serve tenant data instead of silently exposing every tenant", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const ran = vi.fn();
    await expect(withTenant("any-tenant", async () => { ran(); return 1; })).rejects.toMatchObject({
      code: "RLS_EXEMPT",
      status: 503,
      message: expect.not.stringContaining("bibliotek"), // the caller never sees the role name
    });
    expect(ran).not.toHaveBeenCalled(); // the callback (and its queries) never ran
    expect(log).toHaveBeenCalledWith(expect.stringContaining("owns the tables")); // the detail is in the server log
  });
});
