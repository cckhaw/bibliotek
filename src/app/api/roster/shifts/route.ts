import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { createShift, shiftSchema } from "@/lib/services/roster";

export const POST = route(async (req) => {
  const u = await requireApi("roster:manage");
  const input = await jsonBody(req, shiftSchema);
  const shift = await withTenant(u.tenantId, (tx) => createShift(tx, { tenantId: u.tenantId, actorId: u.id, input }));
  return { ok: true, id: shift.id };
});
