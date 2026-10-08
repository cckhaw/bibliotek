import type { SubscriptionTier } from "@prisma/client";
import { advisoryLock, type Tx } from "../db";
import { AppError, notFound } from "../errors";

/** Defaults applied when a tier is selected in the super-admin console (operators can still override). */
export const TIER_PRESETS: Record<SubscriptionTier, { maxStudents: number; maxBooks: number }> = {
  FREE: { maxStudents: 100, maxBooks: 500 },
  STANDARD: { maxStudents: 500, maxBooks: 2000 },
  ENTERPRISE: { maxStudents: 10_000, maxBooks: 100_000 },
};

export interface LicenseUsage {
  students: number;
  books: number;
  maxStudents: number;
  maxBooks: number;
  mode: "STUDENTS" | "BOOKS" | "BOTH";
}

/** Counted against the license: non-graduated students (incl. pending) and non-lost physical copies. */
export async function getUsage(tx: Tx, tenantId: string): Promise<LicenseUsage> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw notFound("Tenant");
  const [students, books] = await Promise.all([
    tx.user.count({ where: { role: "STUDENT", status: { not: "GRADUATED" } } }),
    tx.bookCopy.count({ where: { condition: { not: "LOST" } } }),
  ]);
  return { students, books, maxStudents: tenant.maxStudents, maxBooks: tenant.maxBooks, mode: tenant.licenseMode };
}

/**
 * Enforcement hook. Call inside the SAME transaction as the insert; the advisory lock serialises
 * concurrent registrations/imports for the tenant so two requests cannot both squeeze under the cap.
 */
export async function assertCapacity(tx: Tx, tenantId: string, add: { students?: number; books?: number }) {
  await advisoryLock(tx, `license:${tenantId}`);
  const u = await getUsage(tx, tenantId);
  const checkStudents = u.mode !== "BOOKS";
  const checkBooks = u.mode !== "STUDENTS";

  if (checkStudents && add.students && u.students + add.students > u.maxStudents) {
    throw new AppError(
      "LICENSE_LIMIT_STUDENTS",
      `Student limit reached (${u.students}/${u.maxStudents}). ${Math.max(0, u.maxStudents - u.students)} seat(s) left; this action needs ${add.students}. Contact your administrator to upgrade.`,
      403,
      { used: u.students, limit: u.maxStudents },
    );
  }
  if (checkBooks && add.books && u.books + add.books > u.maxBooks) {
    throw new AppError(
      "LICENSE_LIMIT_BOOKS",
      `Book limit reached (${u.books}/${u.maxBooks}). ${Math.max(0, u.maxBooks - u.books)} copy slot(s) left; this action needs ${add.books}. Contact your administrator to upgrade.`,
      403,
      { used: u.books, limit: u.maxBooks },
    );
  }
}
