import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// No RESEND_API_KEY / SMTP_URL: simulates a production deploy where the variables were never set.
delete process.env.RESEND_API_KEY;
delete process.env.SMTP_URL;

import { sysDb } from "@/lib/db";
import { sendSetupLink } from "@/lib/services/platform-users";
import { deliverNow, enqueueEmails } from "@/lib/mail/outbox";

const run = Math.random().toString(36).slice(2, 8);
const db = sysDb();
let adminId: string, operatorId: string, tenantId: string;

beforeAll(async () => {
  const t = await db.tenant.create({ data: { name: "NoMail", code: `nomail-${run}` } });
  tenantId = t.id;
  adminId = (await db.user.create({ data: { tenantId, role: "TENANT_ADMIN", email: `a-${run}@example.test`, fullName: "A", passwordHash: "!x" } })).id;
  operatorId = (await db.user.create({ data: { role: "SUPER_ADMIN", email: `op-${run}@example.test`, fullName: "Op", passwordHash: "!x" } })).id;
  await db.emailOutbox.updateMany({ where: { status: "PENDING" }, data: { scheduledAt: new Date(Date.now() + 86_400_000) } });
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await db.emailOutbox.deleteMany({ where: { OR: [{ tenantId }, { dedupeKey: { contains: run } }] } });
  await db.tenant.deleteMany({ where: { id: tenantId } });
  await db.user.deleteMany({ where: { id: { in: [operatorId] } } });
  await db.$disconnect();
});

describe("email not configured in production", () => {
  it("does NOT pretend to send: the setup-link action fails with a clear reason and the email stays queued", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendSetupLink(operatorId, adminId)).rejects.toMatchObject({ code: "EMAIL_NOT_SENT", status: 502, message: expect.stringContaining("RESEND_API_KEY") });
    const row = await db.emailOutbox.findFirstOrThrow({ where: { tenantId, kind: "INVITE" } });
    expect(row.status).toBe("PENDING");
    expect(row.lastError).toContain("Email is not configured");
  });

  it("deliverNow reports the failure instead of a false success", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await db.$transaction((tx) => enqueueEmails(tx, [{ tenantId: null, to: `x-${run}@example.test`, subject: "s", body: "b", kind: "DUE_SOON", dedupeKey: `nomail-${run}` }]));
    await db.emailOutbox.updateMany({ where: { dedupeKey: `nomail-${run}` }, data: { scheduledAt: new Date(Date.now() - 1000) } });
    const r = await deliverNow(`nomail-${run}`);
    expect(r.sent).toBe(false);
    expect(r.error).toContain("not configured");
  });
});
