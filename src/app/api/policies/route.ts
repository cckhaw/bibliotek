import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { audit } from "@/lib/audit";

const policySchema = z.object({
  name: z.string().trim().min(1).max(120),
  studentType: z.string().trim().toUpperCase().max(40).optional().transform((v) => v || null),
  freeRentalDays: z.coerce.number().int().min(1).max(365),
  dailyFineAmount: z.coerce.number().min(0).max(1000),
  maxLoansPerUser: z.coerce.number().int().min(1).max(100),
  gracePeriodDays: z.coerce.number().int().min(0).max(60),
  maxRenewals: z.coerce.number().int().min(0).max(20),
  renewalDays: z.coerce.number().int().min(1).max(90),
  fineBlockThreshold: z.coerce.number().min(0).max(100000),
  maxFinePerLoan: z.coerce.number().min(0).max(100000).optional().or(z.literal("").transform(() => undefined)),
  isDefault: z.boolean().optional(),
});

export const POST = route(async (req) => {
  const u = await requireApi("policy:manage");
  const b = await jsonBody(req, policySchema);
  await withTenant(u.tenantId, async (tx) => {
    // "Default" means default for its student type (NULL = everyone); keep exactly one per type.
    const isDefault = b.isDefault ?? b.studentType == null;
    if (isDefault) await tx.borrowPolicy.updateMany({ where: { studentType: b.studentType, isDefault: true }, data: { isDefault: false } });
    const p = await tx.borrowPolicy.create({ data: { ...b, tenantId: u.tenantId, isDefault, maxFinePerLoan: b.maxFinePerLoan ?? null } });
    await audit(tx, { tenantId: u.tenantId, userId: u.id, action: "POLICY_CREATED", details: { policyId: p.id, name: p.name } });
  });
  return { ok: true };
});
