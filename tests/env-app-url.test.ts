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
});
