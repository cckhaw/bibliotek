import { describe, expect, it, vi } from "vitest";

// SYSTEM_DATABASE_URL forgotten: the system connection falls back to the RESTRICTED runtime role.
process.env.DATABASE_URL = "postgresql://bibliotek_app:bibliotek_app@localhost:5432/bibliotek";
process.env.SYSTEM_DATABASE_URL = "   "; // blank in the dashboard == unset

import { assertSystemRole, healthCheck } from "@/lib/db";
import { login } from "@/lib/services/accounts";

describe("SYSTEM_DATABASE_URL missing/blank (system connection is the restricted role)", () => {
  it("is detected with a clear code instead of every login silently failing as 'wrong password'", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(assertSystemRole()).rejects.toMatchObject({ code: "SYSTEM_RESTRICTED", status: 503 });
    await expect(login({ email: "admin@demo.edu", password: "whatever-123" })).rejects.toMatchObject({ code: "SYSTEM_RESTRICTED" });
  });
  it("shows up on the health check", async () => {
    const h = await healthCheck();
    expect(h.env).toBe("ok");
    expect(h.systemRole).toBe("SYSTEM_RESTRICTED");
    expect(h.rls).toBe("ok"); // the runtime role itself is correct
    expect(h.appTables).toBe("ok");
  });
});
