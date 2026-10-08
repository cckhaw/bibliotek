import type { Prisma } from "@prisma/client";
import type { Tx } from "./db";

export async function audit(
  tx: Tx,
  e: { tenantId: string | null; userId?: string | null; action: string; details?: Prisma.InputJsonValue; ip?: string | null },
) {
  await tx.auditLog.create({
    data: { tenantId: e.tenantId, userId: e.userId ?? null, action: e.action, details: e.details, ipAddress: e.ip ?? null },
  });
}
