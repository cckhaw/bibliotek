import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "./env";
import { runWithTenant, tenantScopeExtension } from "./tenant-scope";
import { RLS_FIX, checkRlsEnforced } from "./rls-guard";
import { AppError } from "./errors";
import { classifyInfraError, infraMessage } from "./infra-errors";

export type Tx = Prisma.TransactionClient;

const makeAppClient = () => new PrismaClient({ datasourceUrl: env().DATABASE_URL }).$extends(tenantScopeExtension);
const g = globalThis as unknown as { __appDb?: ReturnType<typeof makeAppClient>; __sysDb?: PrismaClient; __rlsOk?: boolean; __sysOk?: boolean };

/**
 * Runtime client. Must connect as a NON-owner role so Postgres RLS applies, and every query is additionally forced to
 * the current tenant by `tenantScopeExtension` (two independent layers of isolation).
 */
function appDb() {
  return (g.__appDb ??= makeAppClient());
}

/** Fail closed: never serve tenant data over a connection that is exempt from Row-Level Security. Checked once per process. */
async function assertRlsEnforced() {
  if (g.__rlsOk) return;
  const problem = await checkRlsEnforced(appDb());
  if (problem) {
    // Full detail (including the role name) goes to the server log only; the caller sees a safe code.
    console.error(`[security] Tenant isolation is not enforced: ${problem}. ${RLS_FIX}`);
    throw new AppError("RLS_EXEMPT", infraMessage("RLS_EXEMPT"), 503);
  }
  g.__rlsOk = true;
}

/**
 * System client. Connects as the table owner (bypasses RLS). Use ONLY for: login / token redemption,
 * tenant lookup by code, super-admin operations, and cron fan-out (listing tenants).
 * Per-tenant work inside jobs still goes through `withTenant`.
 */
export function sysDb(): PrismaClient {
  return (g.__sysDb ??= new PrismaClient({ datasourceUrl: env().SYSTEM_DATABASE_URL ?? env().DATABASE_URL }));
}

/**
 * Run `fn` in a transaction scoped to one tenant. `set_config(..., true)` is transaction-local, so the
 * tenant id can never leak to another request that reuses the pooled connection.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  if (!tenantId) throw new Error("withTenant requires a tenantId");
  await assertRlsEnforced();
  return runWithTenant(tenantId, () =>
    appDb().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        // `await` (not a bare return) keeps a lazily-returned Prisma query inside the tenant scope until it has run.
        return await fn(tx as unknown as Tx);
      },
      { timeout: opts.timeoutMs ?? 15_000, maxWait: 5_000 },
    ),
  );
}

/** Serialise concurrent work on a key for the duration of the transaction (e.g. per-user loan limits). */
export async function advisoryLock(tx: Tx, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

export function isUniqueViolation(e: unknown, field?: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return false;
  if (!field) return true;
  return JSON.stringify(e.meta ?? {}).includes(field);
}

/**
 * The system connection must be EXEMPT from RLS (the owner role): login, session lookup and super-admin read across
 * tenants. If SYSTEM_DATABASE_URL is unset it falls back to DATABASE_URL (the restricted role), every lookup silently
 * returns nothing and nobody can sign in. Detect that and say so. Checked once per process.
 */
export async function assertSystemRole() {
  if (g.__sysOk) return;
  const restricted = (await checkRlsEnforced(sysDb())) === null;
  if (restricted) {
    console.error("[config] SYSTEM_DATABASE_URL is missing or uses the restricted role: login and super-admin cannot read across tenants. Set SYSTEM_DATABASE_URL to the OWNER role (e.g. bibliotek).");
    throw new AppError("SYSTEM_RESTRICTED", infraMessage("SYSTEM_RESTRICTED"), 503);
  }
  g.__sysOk = true;
}

/**
 * Coarse, secret-free status of each moving part, for /api/health. Each value is "ok" or a short code
 * (see infra-errors.ts); never a hostname, username or password.
 */
export async function healthCheck() {
  const checks: Record<string, string> = { env: "ok", systemDb: "skipped", systemRole: "skipped", schema: "skipped", appDb: "skipped", rls: "skipped" };
  try { env(); } catch { checks.env = "ENV_INVALID"; return checks; }

  const attempt = async (key: string, fn: () => Promise<unknown>) => {
    try { await fn(); checks[key] = "ok"; return true; }
    catch (e) { checks[key] = classifyInfraError(e) ?? "ERROR"; return false; }
  };
  if (await attempt("systemDb", () => sysDb().$queryRaw`SELECT 1`)) {
    await attempt("schema", () => sysDb().tenant.count());
    // The system connection must be EXEMPT from RLS (owner role): login and super-admin read across tenants. If
    // SYSTEM_DATABASE_URL is missing it falls back to DATABASE_URL (restricted) and nobody can sign in.
    try { checks.systemRole = (await checkRlsEnforced(sysDb())) ? "ok" : "SYSTEM_RESTRICTED"; } catch (e) { checks.systemRole = classifyInfraError(e) ?? "ERROR"; }
  }
  if (await attempt("appDb", () => appDb().$queryRaw`SELECT 1`)) {
    try {
      const problem = await checkRlsEnforced(appDb());
      checks.rls = problem ? "RLS_EXEMPT" : "ok";
    } catch (e) { checks.rls = classifyInfraError(e) ?? "ERROR"; }
  }
  return checks;
}
