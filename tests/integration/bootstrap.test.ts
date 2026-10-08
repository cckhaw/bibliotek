import { afterAll, describe, expect, it } from "vitest";
import { sysDb } from "@/lib/db";
import { ensureSuperAdmin } from "@/lib/bootstrap";
import { login } from "@/lib/services/accounts";

const run = Math.random().toString(36).slice(2, 8);
const email = `owner-${run}@example.test`;
const env = (o: Record<string, string | undefined>) => o as unknown as NodeJS.ProcessEnv;
const db = sysDb();

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { contains: run } } });
  await db.tenant.deleteMany({ where: { code: `boot-${run}` } });
  await db.$disconnect();
});

describe("environment-managed super admin", () => {
  it("does nothing when the variables are not set", async () => {
    expect(await ensureSuperAdmin(env({}))).toBe("skipped");
  });

  it("creates the account, can log in, and is idempotent", async () => {
    const e = env({ SUPERADMIN_EMAIL: email.toUpperCase(), SUPERADMIN_PASSWORD: "first-password-123" });
    expect(await ensureSuperAdmin(e)).toBe("created");
    expect(await ensureSuperAdmin(e)).toBe("unchanged");
    const u = await login({ email, password: "first-password-123" });
    expect(u).toMatchObject({ role: "SUPER_ADMIN", tenantId: null });
  });

  it("rotating the password in the environment replaces the old one", async () => {
    expect(await ensureSuperAdmin(env({ SUPERADMIN_EMAIL: email, SUPERADMIN_PASSWORD: "second-password-456" }))).toBe("updated");
    await expect(login({ email, password: "first-password-123" })).rejects.toMatchObject({ code: "BAD_CREDENTIALS" });
    await expect(login({ email, password: "second-password-456" })).resolves.toBeTruthy();
  });

  it("re-activates a suspended super admin", async () => {
    await db.user.update({ where: { email }, data: { status: "SUSPENDED" } });
    expect(await ensureSuperAdmin(env({ SUPERADMIN_EMAIL: email, SUPERADMIN_PASSWORD: "second-password-456" }))).toBe("updated");
    expect((await db.user.findUniqueOrThrow({ where: { email } })).status).toBe("ACTIVE");
  });

  it("rejects a weak password and refuses to take over a school's account", async () => {
    await expect(ensureSuperAdmin(env({ SUPERADMIN_EMAIL: email, SUPERADMIN_PASSWORD: "short" }))).rejects.toThrow(/at least 12/);
    const t = await db.tenant.create({ data: { name: "Boot", code: `boot-${run}` } });
    const tenantUser = `student-${run}@example.test`;
    await db.user.create({ data: { tenantId: t.id, email: tenantUser, fullName: "S", passwordHash: "!x" } });
    await expect(ensureSuperAdmin(env({ SUPERADMIN_EMAIL: tenantUser, SUPERADMIN_PASSWORD: "long-enough-password" }))).rejects.toThrow(/non-platform account/);
    expect((await db.user.findUniqueOrThrow({ where: { email: tenantUser } })).role).toBe("STUDENT");
  });
});
