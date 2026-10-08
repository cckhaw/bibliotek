import { sysDb, withTenant } from "../db";
import { enqueueEmails, flushOutbox } from "../mail/outbox";
import { dueSoon, overdue } from "../mail/templates";
import { resolvePolicy } from "./policy";
import { syncFine } from "./fines";

const DAY = 86_400_000;
const BATCH = 500;

async function activeTenants() {
  return sysDb().tenant.findMany({ where: { isSuspended: false }, select: { id: true, name: true, reminderLeadDays: true } });
}

/**
 * Per-tenant fan-out. One tenant failing must not stop the others; failures are collected and reported.
 * Each tenant's work runs inside withTenant, so jobs are subject to RLS exactly like user requests.
 */
async function eachTenant<T>(fn: (t: { id: string; name: string; reminderLeadDays: number }) => Promise<T>) {
  const out: { tenantId: string; result?: T; error?: string }[] = [];
  for (const t of await activeTenants()) {
    try { out.push({ tenantId: t.id, result: await fn(t) }); }
    catch (e) { console.error(`job failed for tenant ${t.id}`, e); out.push({ tenantId: t.id, error: String(e).slice(0, 300) }); }
  }
  return out;
}

/** Email "due soon" and "overdue" notices and flip ACTIVE -> OVERDUE. Safe to re-run: emails are de-duplicated. */
export async function runReminders(now = new Date()) {
  return eachTenant((tenant) =>
    withTenant(tenant.id, async (tx) => {
      // 1. Mark overdue
      const flipped = await tx.loan.updateMany({ where: { returnedAt: null, status: "ACTIVE", dueDate: { lt: now } }, data: { status: "OVERDUE" } });

      let queued = 0;
      let cursor: string | undefined;
      for (;;) {
        const loans = await tx.loan.findMany({
          where: {
            returnedAt: null, user: { status: "ACTIVE" },
            dueDate: { lt: new Date(now.getTime() + tenant.reminderLeadDays * DAY) },
          },
          include: { user: true, bookCopy: { include: { catalogItem: { select: { title: true } } } } },
          orderBy: { id: "asc" }, take: BATCH, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (loans.length === 0) break;
        cursor = loans[loans.length - 1].id;

        const mails = loans.map((l) => {
          const title = l.bookCopy.catalogItem.title;
          const base = { tenantId: tenant.id, to: l.user.email };
          if (l.dueDate >= now) {
            return { ...base, kind: "DUE_SOON" as const, dedupeKey: `due-soon:${l.id}:${l.dueDate.getTime()}`, ...dueSoon({ name: l.user.fullName, title, dueDate: l.dueDate, school: tenant.name }) };
          }
          const daysLate = Math.max(1, Math.ceil((now.getTime() - l.dueDate.getTime()) / DAY));
          // One notice immediately, then every 3 days (buckets 0,1,2,...) until returned.
          return { ...base, kind: "OVERDUE" as const, dedupeKey: `overdue:${l.id}:${Math.floor((daysLate - 1) / 3)}`, ...overdue({ name: l.user.fullName, title, dueDate: l.dueDate, daysLate, school: tenant.name }) };
        });
        queued += await enqueueEmails(tx, mails);
        await tx.loan.updateMany({ where: { id: { in: loans.map((l) => l.id) } }, data: { reminderSentAt: now } });
      }
      return { markedOverdue: flipped.count, emailsQueued: queued };
    }),
  );
}

/** Daily fine accrual for every open overdue loan. Idempotent: recomputes the total from dates, never adds to it. */
export async function runDailyFines(now = new Date()) {
  return eachTenant((tenant) =>
    withTenant(tenant.id, async (tx) => {
      let touched = 0;
      let cursor: string | undefined;
      const policyCache = new Map<string, Awaited<ReturnType<typeof resolvePolicy>>>();
      for (;;) {
        const loans = await tx.loan.findMany({
          where: { returnedAt: null, dueDate: { lt: now } },
          include: { user: { select: { studentType: true } } },
          orderBy: { id: "asc" }, take: BATCH, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (loans.length === 0) break;
        cursor = loans[loans.length - 1].id;
        for (const l of loans) {
          const key = l.user.studentType ?? "";
          let policy = policyCache.get(key);
          if (!policy) policyCache.set(key, (policy = await resolvePolicy(tx, l.user.studentType)));
          if (await syncFine(tx, l, policy, now)) touched++;
        }
      }
      return { finesUpdated: touched };
    }, { timeoutMs: 120_000 }),
  );
}

/** Daily per-tenant usage snapshot for the super-admin dashboard. Runs on the system role (reads every tenant). */
export async function runTelemetry(now = new Date()) {
  const db = sysDb();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = new Date(now.getTime() - 30 * DAY);
  const tables = ["users", "catalog_items", "book_copies", "loans", "fines", "audit_logs", "duty_shifts", "extension_requests"];

  return eachTenant(async (t) => {
    const [students, books, activeLoans, active, fines] = await Promise.all([
      db.user.count({ where: { tenantId: t.id, role: "STUDENT", status: { not: "GRADUATED" } } }),
      db.bookCopy.count({ where: { tenantId: t.id, condition: { not: "LOST" } } }),
      db.loan.count({ where: { tenantId: t.id, returnedAt: null } }),
      db.loan.findMany({ where: { tenantId: t.id, borrowedAt: { gte: since } }, distinct: ["userId"], select: { userId: true } }),
      db.fine.aggregate({ where: { tenantId: t.id, status: "UNPAID" }, _sum: { amount: true } }),
    ]);
    let bytes = 0n;
    for (const table of tables) {
      // Table names come from the fixed list above (never user input).
      const r = await db.$queryRawUnsafe<{ s: bigint }[]>(`SELECT COALESCE(SUM(pg_column_size(t.*)),0)::bigint AS s FROM ${table} t WHERE "tenantId" = $1`, t.id);
      bytes += r[0]?.s ?? 0n;
    }
    const data = { students, bookCopies: books, activeLoans, activeUsers: active.length, openFines: fines._sum.amount ?? 0, storageBytes: bytes };
    await db.usageSnapshot.upsert({ where: { tenantId_day: { tenantId: t.id, day } }, create: { tenantId: t.id, day, ...data }, update: data });
    return data.storageBytes.toString();
  });
}

export const runOutbox = () => flushOutbox(200);

export const JOBS = { reminders: runReminders, fines: runDailyFines, telemetry: runTelemetry, outbox: runOutbox } as const;
export type JobName = keyof typeof JOBS;
