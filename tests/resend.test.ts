import { describe, expect, it, vi } from "vitest";
import { sendViaResend } from "@/lib/mail/resend";

const msg = { apiKey: "re_test_key", from: "Bibliotek <no-reply@example.com>", to: "a@b.test", subject: "Hi", text: "Body", idempotencyKey: "bibliotek-123" };
const reply = (status: number, json: unknown) => vi.fn(async () => new Response(JSON.stringify(json), { status })) as unknown as typeof fetch;

describe("sendViaResend", () => {
  it("POSTs the documented payload with bearer auth and an idempotency key", async () => {
    const f = reply(200, { id: "abc" });
    expect(await sendViaResend(msg, f)).toEqual({ id: "abc" });
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer re_test_key");
    expect(h["Idempotency-Key"]).toBe("bibliotek-123");
    expect(JSON.parse(init.body as string)).toEqual({ from: msg.from, to: ["a@b.test"], subject: "Hi", text: "Body" });
  });

  it("throws with Resend's error so the outbox can retry with backoff", async () => {
    await expect(sendViaResend(msg, reply(403, { name: "validation_error", message: "domain is not verified" }))).rejects.toThrow(/403 validation_error: domain is not verified/);
    await expect(sendViaResend(msg, reply(429, { name: "rate_limit_exceeded", message: "Too many requests" }))).rejects.toThrow(/429/);
  });

  it("copes with a non-JSON error body", async () => {
    const f = vi.fn(async () => new Response("Bad gateway", { status: 502 })) as unknown as typeof fetch;
    await expect(sendViaResend(msg, f)).rejects.toThrow(/Resend 502/);
  });

  it("never puts the API key in an error", async () => {
    const e = await sendViaResend(msg, reply(401, { name: "restricted_api_key", message: "API key is invalid" })).catch((x) => String(x));
    expect(e).not.toContain("re_test_key");
  });
});
