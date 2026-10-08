import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "./env";

export type Tx = Prisma.TransactionClient;

const g = globalThis as unknown as { __appDb?: PrismaClient; __sysDb?: PrismaClient };

/** Runtime client. Connects as a NON-owner role, so Postgres RLS applies to every query. */
function appDb(): PrismaClient {
  return (g.__appDb ??= new PrismaClient({ datasourceUrl: env().DATABASE_URL }));
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
export function withTenant<T>(
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  if (!tenantId) throw new Error("withTenant requires a tenantId");
  return appDb().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    },
    { timeout: opts.timeoutMs ?? 15_000, maxWait: 5_000 },
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
