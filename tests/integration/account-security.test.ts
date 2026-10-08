import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { sysDb } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { login, requestPasswordReset, resetPasswordWithOtp } from "@/lib/services/accounts";
import { sendSetupLink, updateOwnProfile, updateTenantAdmin } from "@/lib/services/platform-users";

const run = Math.random().toString(36).slice(2, 8);
const db = sysDb();
const OLD = "old-password-12345";
const NEW = "brand-new-password-1";
let tenantId: string, studentEmail: string, adminId: string, adminEmail: string, opId: string, opEmail: string;
let ipN = 0;
const ip = () => `ip-${run}-${++ipN}`; // fresh throttle bucket per call

/** The dev mail transport logs the rendered email; capture the 6-digit code from it. */
function captureCode(): () => string {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  return () => {
    const text = spy.mock.calls.map((c) => String(c[0])).join("\n");
    const m = text.match(/\n\s+(\d{6})\n/);
    if (!m) throw new Error("no code was emailed");
    return m[1];
  };
}
afterEach(() => { vi.restoreAllMocks(); delete process.env.SUPERADMIN_EMAIL; });

beforeAll(async () => {
  const pw = await hashPassword(OLD);
  const t = await db.tenant.create({ data: { name: "Sec", code: `sec-${run}` } });
  tenantId = t.id;
  studentEmail = `stu-${run}@example.test`;
  await db.user.create({ data: { tenantId, role: "STUDENT", email: studentEmail, fullName: "Stu Dent", passwordHash: pw, status: "ACTIVE", studentId: "A1" } });
  await db.user.create({ data: { tenantId, role: "STUDENT", email: `pend-${run}@example.test`, fullName: "Pending", passwordHash: pw, status: "PENDING_VERIFICATION", studentId: "A2" } });
  adminEmail = `adm-${run}@example.test`;
  adminId = (await db.user.create({ data: { tenantId, role: "TENANT_ADMIN", email: adminEmail, fullName: "Old Admin", passwordHash: pw } })).id;
  opEmail = `op-${run}@example.test`;
  opId = (await db.user.create({ data: { role: "SUPER_ADMIN", email: opEmail, fullName: "Operator", passwordHash: pw } })).id;
});
afterAll(async () => {
  await db.tenant.deleteMany({ where: { code: `sec-${run}` } });
  await db.user.deleteMany({ where: { email: { contains: run } } });
  await db.$disconnect();
});

const otpCount = (email: string) => db.passwordResetOtp.count({ where: { user: { email } } });

describe("forgot password (email OTP)", () => {
  it("gives the identical response for unknown, pending and active accounts, and only emails the active one", async () => {
    const code = captureCode();
    const unknown = await requestPasswordReset(`nobody-${run}@example.test`, ip());
    const pending = await requestPasswordReset(`pend-${run}@example.test`, ip());
    expect(await otpCount(`nobody-${run}@example.test`)).toBe(0);
    expect(await otpCount(`pend-${run}@example.test`)).toBe(0);
    const active = await requestPasswordReset(studentEmail, ip());
    expect(unknown).toEqual(pending);
    expect(pending).toEqual(active);
    expect(code()).toMatch(/^\d{6}$/);
    expect(await otpCount(studentEmail)).toBe(1);
  });

  it("stores only a keyed hash, and does not re-send within the 60s cooldown", async () => {
    const row = await db.passwordResetOtp.findFirstOrThrow({ where: { user: { email: studentEmail } } });
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    await requestPasswordReset(studentEmail, ip());
    expect(await otpCount(studentEmail)).toBe(1);
  });

  it("rejects a wrong code, burns the OTP after 5 wrong tries (even for the right code), and never changes the password", async () => {
    await db.passwordResetOtp.deleteMany({ where: { user: { email: studentEmail } } });
    const code = captureCode();
    await requestPasswordReset(studentEmail, ip());
    const good = code();
    const wrong = good === "000000" ? "111111" : "000000";
    const i = ip();
    for (let n = 0; n < 5; n++) await expect(resetPasswordWithOtp({ email: studentEmail, code: wrong, password: NEW }, i)).rejects.toMatchObject({ code: "BAD_CODE" });
    await expect(resetPasswordWithOtp({ email: studentEmail, code: good, password: NEW }, ip())).rejects.toMatchObject({ code: "BAD_CODE" });
    await expect(login({ email: studentEmail, password: OLD, ip: ip() })).resolves.toBeTruthy();
  });

  it("a correct code sets the new password once; the code cannot be reused", async () => {
    await db.passwordResetOtp.updateMany({ where: { user: { email: studentEmail } }, data: { createdAt: new Date(Date.now() - 120_000) } }); // clear cooldown
    const code = captureCode();
    await requestPasswordReset(studentEmail, ip());
    const good = code();
    await expect(resetPasswordWithOtp({ email: studentEmail, code: good, password: "short" }, ip())).rejects.toThrow(); // policy rejected BEFORE consuming the code
    const r = await resetPasswordWithOtp({ email: studentEmail, code: good, password: NEW }, ip());
    expect(r.redirect).toBe("/login");
    await expect(login({ email: studentEmail, password: OLD, ip: ip() })).rejects.toMatchObject({ code: "BAD_CREDENTIALS" });
    await expect(login({ email: studentEmail, password: NEW, ip: ip() })).resolves.toBeTruthy();
    await expect(resetPasswordWithOtp({ email: studentEmail, code: good, password: "another-password-9" }, ip())).rejects.toMatchObject({ code: "BAD_CODE" });
    expect(await db.auditLog.count({ where: { tenantId, action: "PASSWORD_RESET" } })).toBe(1);
  });

  it("expired codes fail, and a newer code invalidates the older one", async () => {
    await db.passwordResetOtp.deleteMany({ where: { user: { email: studentEmail } } });
    const c1 = captureCode();
    await requestPasswordReset(studentEmail, ip());
    const first = c1();
    vi.restoreAllMocks();
    await db.passwordResetOtp.updateMany({ where: { user: { email: studentEmail } }, data: { createdAt: new Date(Date.now() - 120_000) } });

    const c2 = captureCode();
    await requestPasswordReset(studentEmail, ip());
    const second = c2();
    if (first !== second) await expect(resetPasswordWithOtp({ email: studentEmail, code: first, password: OLD }, ip())).rejects.toMatchObject({ code: "BAD_CODE" });

    await db.passwordResetOtp.updateMany({ where: { user: { email: studentEmail }, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(resetPasswordWithOtp({ email: studentEmail, code: second, password: OLD }, ip())).rejects.toMatchObject({ code: "BAD_CODE" });
  });

  it("is not available for the environment-managed operator account", async () => {
    process.env.SUPERADMIN_EMAIL = opEmail.toUpperCase();
    await requestPasswordReset(opEmail, ip());
    expect(await otpCount(opEmail)).toBe(0);
  });

  it("throttles repeated requests for one address", async () => {
    const i = ip();
    for (let n = 0; n < 5; n++) await requestPasswordReset(`spam-${run}@example.test`, i);
    await expect(requestPasswordReset(`spam-${run}@example.test`, i)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("super admin: edit school admin and own profile", () => {
  it("updates a school admin's name and email, audited; the new email can log in", async () => {
    const newEmail = `adm2-${run}@example.test`;
    await updateTenantAdmin(opId, adminId, { fullName: "Corrected Admin", email: newEmail });
    expect(await db.user.findUniqueOrThrow({ where: { id: adminId } })).toMatchObject({ fullName: "Corrected Admin", email: newEmail });
    const log = await db.auditLog.findFirstOrThrow({ where: { tenantId, action: "TENANT_ADMIN_UPDATED" } });
    expect(JSON.stringify(log.details)).toContain(adminEmail);
    await expect(login({ email: newEmail, password: OLD, ip: ip() })).resolves.toBeTruthy();
    adminEmail = newEmail;
  });

  it("rejects an email another account uses, and non-admin targets", async () => {
    await expect(updateTenantAdmin(opId, adminId, { fullName: "X", email: studentEmail })).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    const stu = await db.user.findFirstOrThrow({ where: { email: studentEmail } });
    await expect(updateTenantAdmin(opId, stu.id, { fullName: "X", email: `z-${run}@example.test` })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sends a setup link to the (corrected) address and revokes earlier unused links", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await sendSetupLink(opId, adminId);
    await sendSetupLink(opId, adminId);
    const tokens = await db.passwordToken.findMany({ where: { userId: adminId } });
    expect(tokens.filter((t) => !t.usedAt)).toHaveLength(1);
    expect(await db.emailOutbox.count({ where: { toEmail: adminEmail, kind: "INVITE" } })).toBe(2);
  });

  it("operator profile: name is free; changing email needs the current password; env-managed email is locked", async () => {
    await updateOwnProfile(opId, { fullName: "Renamed Operator" });
    expect((await db.user.findUniqueOrThrow({ where: { id: opId } })).fullName).toBe("Renamed Operator");
    const next = `op2-${run}@example.test`;
    await expect(updateOwnProfile(opId, { fullName: "R", email: next })).rejects.toMatchObject({ code: "BAD_PASSWORD" });
    await expect(updateOwnProfile(opId, { fullName: "R", email: next, currentPassword: "wrong-password-1" })).rejects.toMatchObject({ code: "BAD_PASSWORD" });
    await updateOwnProfile(opId, { fullName: "R", email: next, currentPassword: OLD });
    expect((await db.user.findUniqueOrThrow({ where: { id: opId } })).email).toBe(next);

    process.env.SUPERADMIN_EMAIL = next;
    await expect(updateOwnProfile(opId, { fullName: "R", email: `op3-${run}@example.test`, currentPassword: OLD })).rejects.toMatchObject({ code: "EMAIL_MANAGED" });
    await expect(updateOwnProfile(opId, { fullName: "Still editable name" })).resolves.toBeUndefined();
  });
});
