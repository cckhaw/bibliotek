import { route } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { markFinePaid } from "@/lib/services/circulation";

export const POST = route(async (_req, ctx) => {
  const u = await requireApi("fines:manage");
  const { id } = await ctx.params;
  await withTenant(u.tenantId, (tx) => markFinePaid(tx, { tenantId: u.tenantId, actorId: u.id, fineId: id }));
  return { ok: true };
});
