import { route } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const DELETE = route(async (_req, ctx) => {
  const u = await requireApi("policy:manage");
  const { id } = await ctx.params;
  await withTenant(u.tenantId, async (tx) => {
    const p = await tx.borrowPolicy.findUnique({ where: { id } });
    if (!p) throw notFound("Policy");
    if (p.isDefault && p.studentType == null) throw conflict("DEFAULT_POLICY", "Cannot delete the tenant default policy. Create a new default first.");
    await tx.borrowPolicy.delete({ where: { id } });
    await audit(tx, { tenantId: u.tenantId, userId: u.id, action: "POLICY_DELETED", details: { policyId: id } });
  });
  return { ok: true };
});
