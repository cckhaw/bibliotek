import type { Prisma } from "@prisma/client";
import type { Tx } from "../db";

export interface PolicyRules {
  id: string | null;
  name: string;
  freeRentalDays: number;
  dailyFineAmount: Prisma.Decimal | number;
  maxLoansPerUser: number;
  gracePeriodDays: number;
  maxRenewals: number;
  renewalDays: number;
  fineBlockThreshold: Prisma.Decimal | number;
  maxFinePerLoan: Prisma.Decimal | number | null;
}

// Used only if a tenant has deleted every policy; mirrors the schema defaults.
export const FALLBACK_POLICY: PolicyRules = {
  id: null, name: "Built-in default", freeRentalDays: 14, dailyFineAmount: 0.5, maxLoansPerUser: 5,
  gracePeriodDays: 1, maxRenewals: 1, renewalDays: 7, fineBlockThreshold: 10, maxFinePerLoan: null,
};

/** Most specific wins: exact studentType match -> tenant default (no type) -> any default -> built-in. */
export async function resolvePolicy(tx: Tx, studentType: string | null): Promise<PolicyRules> {
  const all = await tx.borrowPolicy.findMany({ orderBy: { createdAt: "asc" } });
  const pick =
    (studentType && all.find((p) => p.studentType === studentType)) ||
    all.find((p) => p.isDefault && p.studentType == null) ||
    all.find((p) => p.isDefault) ||
    all[0];
  return pick ?? FALLBACK_POLICY;
}

/** Due dates land at the end of the due day (UTC) so "14 days" means the whole of day 14. */
export function dueDateFrom(start: Date, days: number): Date {
  const d = new Date(start.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}
