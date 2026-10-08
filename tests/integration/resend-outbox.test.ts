import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

process.env.RESEND_API_KEY = "re_integration_key";
process.env.MAIL_FROM = "Bibliotek <no-reply@example.test>";
delete process.env.SMTP_URL;

import { sysDb } from "@/lib/db";
import { enqueueEmails, flushOutbox } from "@/lib/mail/outbox";

const run = Math.random().toString(36).slice(2, 8);
const db = sysDb();
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => { await db.emailOutbox.deleteMany({ where: { dedupeKey: { contains: run } } }); await db.$disconnect(); });

// Other tests/dev data may leave PENDING rows; park them so only this test's rows are claimed.
beforeAll(async () => { await db.emailOutbox.updateMany({ where: { status: "PENDING" }, data: { scheduledAt: new Date(Date.now() + 86_400_000) } }); });

const mail = (kind: "INVITE" | "DUE_SOON", n: number) => ({ tenantId: null, to: `u${n}-${run}@example.test`, subject: `S${n}`, body: `token-or-body-${n}`, kind, dedupeKey: `resend-${run}-${n}` });
const claimMine = () => db.emailOutbox.updateMany({ where: { dedupeKey: { contains: run } }, data: { scheduledAt: new Date(Date.now() - 1000) } });

describe("outbox -> Resend", () => {
  it("sends via Resend, marks SENT, uses the row id as idempotency key, and scrubs invite tokens", async () => {
    await db.$transaction((tx) => enqueueEmails(tx, [mail("INVITE", 1), mail("DUE_SOON", 2)]));
    const calls: { url: string; headers: Record<string, string>; body: { to: string[]; text: string; from: string } }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
      return new Response(JSON.stringify({ id: "re_1" }), { status: 200 });
    }));
    await claimMine();
    const r = await flushOutbox(50);
    expect(r).toEqual({ sent: 2, failed: 0 });
    expect(calls.map((c) => c.url)).toEqual(Array(2).fill("https://api.resend.com/emails"));
    expect(calls[0].headers.Authorization).toBe("Bearer re_integration_key");
    expect(calls[0].body.from).toBe("Bibliotek <no-reply@example.test>");
    const rows = await db.emailOutbox.findMany({ where: { dedupeKey: { contains: run } }, orderBy: { dedupeKey: "asc" } });
    expect(rows.map((x) => x.status)).toEqual(["SENT", "SENT"]);
    expect(rows[0].body).toBe("[redacted after delivery]"); // INVITE carried a live token
    expect(rows[1].body).toBe("token-or-body-2");
    expect(calls.map((c) => c.headers["Idempotency-Key"]).sort()).toEqual(rows.map((x) => `bibliotek-${x.id}`).sort());
    // second run sends nothing
    vi.stubGlobal("fetch", vi.fn());
    expect((await flushOutbox(50)).sent).toBe(0);
  });

  it("a Resend failure keeps the email queued with backoff and records the reason", async () => {
    await db.$transaction((tx) => enqueueEmails(tx, [mail("DUE_SOON", 3)]));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ name: "validation_error", message: "domain is not verified" }), { status: 403 })));
    await claimMine();
    const r = await flushOutbox(50);
    expect(r).toEqual({ sent: 0, failed: 1 });
    const row = await db.emailOutbox.findFirstOrThrow({ where: { dedupeKey: `resend-${run}-3` } });
    expect(row).toMatchObject({ status: "PENDING", attempts: 1 });
    expect(row.lastError).toContain("domain is not verified");
    expect(row.lastError).not.toContain("re_integration_key");
    expect(row.scheduledAt.getTime()).toBeGreaterThan(Date.now());
  });
});
