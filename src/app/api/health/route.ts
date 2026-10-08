import { healthCheck } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public, secret-free diagnostics: which part of the deployment is broken?
 * Values are "ok" or a short code (ENV_INVALID, DB_AUTH, DB_UNREACHABLE, DB_TLS, DB_SCHEMA, DB_PERMISSION, RLS_EXEMPT, SYSTEM_RESTRICTED, ...).
 * `schema` = the SYSTEM login can read the tables; `appTables` = the restricted APP login can (grants).
 */
export async function GET() {
  const checks = await healthCheck();
  const ok = Object.values(checks).every((v) => v === "ok");
  return Response.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
