import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { audit } from "@/lib/audit";

export const PUT = route(async (req) => {
  const u = await requireApi("policy:manage");
  const b = await jsonBody(req, z.object({
    allowedEmailDomains: z.string().transform((s) => s.split(/[\s,;]+/).map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean)),
    autoApproveStudents: z.boolean(),
    reminderLeadDays: z.coerce.number().int().min(0).max(30),
  }));
  await withTenant(u.tenantId, async (tx) => {
    await tx.tenant.update({ where: { id: u.tenantId }, data: b });
    await audit(tx, { tenantId: u.tenantId, userId: u.id, action: "TENANT_SETTINGS_UPDATED", details: b });
  });
  return { ok: true };
});
