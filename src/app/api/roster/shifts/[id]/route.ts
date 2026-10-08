import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { deleteShift, shiftSchema, updateShift } from "@/lib/services/roster";

export const PUT = route(async (req, ctx) => {
  const u = await requireApi("roster:manage");
  const { id } = await ctx.params;
  const input = await jsonBody(req, shiftSchema);
  await withTenant(u.tenantId, (tx) => updateShift(tx, { tenantId: u.tenantId, actorId: u.id, shiftId: id, input }));
  return { ok: true };
});

export const DELETE = route(async (_req, ctx) => {
  const u = await requireApi("roster:manage");
  const { id } = await ctx.params;
  await withTenant(u.tenantId, (tx) => deleteShift(tx, { tenantId: u.tenantId, actorId: u.id, shiftId: id }));
  return { ok: true };
});
