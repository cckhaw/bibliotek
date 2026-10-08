import { afterEach, describe, expect, it, vi } from "vitest";

const base = { DATABASE_URL: "x", AUTH_SECRET: "0123456789012345678901234567890123456789", CRON_SECRET: "12345678" };
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function appUrl(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...base, APP_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: undefined, ...vars })) {
    if (v === undefined) vi.stubEnv(k, ""); else vi.stubEnv(k, v);
  }
  // empty string == unset for our purposes
  if (!vars.APP_URL) delete process.env.APP_URL;
  if (!vars.VERCEL_PROJECT_PRODUCTION_URL) delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (await import("@/lib/env")).env().APP_URL;
}

describe("APP_URL used in emailed links", () => {
  it("an explicit APP_URL always wins", async () => {
    expect(await appUrl({ APP_URL: "https://library.khaw.cc", VERCEL_PROJECT_PRODUCTION_URL: "bibliotek-tau.vercel.app" })).toBe("https://library.khaw.cc");
  });
  it("ignores a trailing slash so links never contain //", async () => {
    expect(await appUrl({ APP_URL: "https://library.khaw.cc/" })).toBe("https://library.khaw.cc");
  });
  it("on Vercel, falls back to the production hostname instead of localhost", async () => {
    expect(await appUrl({ VERCEL_PROJECT_PRODUCTION_URL: "bibliotek-tau.vercel.app" })).toBe("https://bibliotek-tau.vercel.app");
  });
  it("only uses localhost for local development", async () => {
    expect(await appUrl({})).toBe("http://localhost:3000");
  });

  it("adds https:// when the scheme was forgotten (the usual dashboard typo), http:// for localhost", async () => {
    expect(await appUrl({ APP_URL: "bibliotek.khaw.cc" })).toBe("https://bibliotek.khaw.cc");
    expect(await appUrl({ APP_URL: "  bibliotek.khaw.cc/  " })).toBe("https://bibliotek.khaw.cc");
    expect(await appUrl({ APP_URL: "localhost:3000" })).toBe("http://localhost:3000");
  });
  it("treats a blank value as not set", async () => {
    expect(await appUrl({ APP_URL: "   " })).toBe("http://localhost:3000");
  });
});

describe("invalid environment", () => {
  it("throws a readable error naming the variable but never its value", async () => {
    vi.resetModules();
    for (const [k, v] of Object.entries({ DATABASE_URL: "x", AUTH_SECRET: "short-secret-value", CRON_SECRET: "12345678" })) vi.stubEnv(k, v);
    const { env } = await import("@/lib/env");
    let msg = "";
    try { env(); } catch (e) { msg = (e as Error).message; }
    expect(msg).toContain("Invalid environment configuration");
    expect(msg).toContain("AUTH_SECRET");
    expect(msg).not.toContain("short-secret-value");
  });
  it("a blank MAIL_FROM falls back to the default sender", async () => {
    vi.resetModules();
    for (const [k, v] of Object.entries({ ...base, MAIL_FROM: "  ", RESEND_API_KEY: "" })) vi.stubEnv(k, v);
    const { env } = await import("@/lib/env");
    expect(env().MAIL_FROM).toBe("Bibliotek <noreply@khaw.cc>");
    expect(env().RESEND_API_KEY).toBeUndefined();
  });
});
