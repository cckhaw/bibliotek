import { Prisma } from "@prisma/client";
import type { Tx } from "../db";
import type { PolicyRules } from "./policy";

const DAY_MS = 86_400_000;

/** Whole days late after the grace period. Pure: no I/O, so it is trivially unit-testable. */
export function chargeableDays(dueDate: Date, asOf: Date, graceDays: number): number {
  const late = Math.ceil((asOf.getTime() - dueDate.getTime()) / DAY_MS);
  return Math.max(0, late - Math.max(0, graceDays));
}

/** Money is handled in integer cents to avoid float drift; converted to Decimal only at the DB edge. */
export function computeFineCents(a: { dueDate: Date; asOf: Date; dailyCents: number; graceDays: number; capCents?: number | null }) {
  const days = chargeableDays(a.dueDate, a.asOf, a.graceDays);
  let cents = days * a.dailyCents;
  if (a.capCents != null && a.capCents >= 0) cents = Math.min(cents, a.capCents);
  return { days, cents };
}

export const toCents = (d: Prisma.Decimal | number | string) => Math.round(Number(d) * 100);
export const fromCents = (c: number) => new Prisma.Decimal(c).div(100);

/**
 * Create or refresh the (single) fine of a loan. Idempotent: the daily job and the return flow both call it.
 * PAID / WAIVED fines are never touched again, so a waiver cannot be undone by the next job run.
 */
export async function syncFine(
  tx: Tx,
  loan: { id: string; tenantId: string; userId: string; dueDate: Date },
  rules: PolicyRules,
  asOf: Date,
) {
  const { days, cents } = computeFineCents({
    dueDate: loan.dueDate,
    asOf,
    dailyCents: toCents(rules.dailyFineAmount),
    graceDays: rules.gracePeriodDays,
    capCents: rules.maxFinePerLoan == null ? null : toCents(rules.maxFinePerLoan),
  });
  if (days === 0 || cents === 0) return null;

  const existing = await tx.fine.findUnique({ where: { loanId: loan.id } });
  if (!existing) {
    return tx.fine.create({
      data: { tenantId: loan.tenantId, loanId: loan.id, userId: loan.userId, amount: fromCents(cents), daysOverdue: days },
    });
  }
  if (existing.status !== "UNPAID") return existing;
  if (toCents(existing.amount) === cents) return existing;
  return tx.fine.update({ where: { id: existing.id }, data: { amount: fromCents(cents), daysOverdue: days } });
}

export async function unpaidTotalCents(tx: Tx, userId: string): Promise<number> {
  const r = await tx.fine.aggregate({ where: { userId, status: "UNPAID" }, _sum: { amount: true } });
  return r._sum.amount ? toCents(r._sum.amount) : 0;
}
