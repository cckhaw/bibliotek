import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { publishRoster } from "@/lib/services/roster";

export const POST = route(async (req) => {
  const u = await requireApi("roster:manage");
  const b = await jsonBody(req, z.object({ from: z.coerce.date(), to: z.coerce.date(), branchId: z.string().optional() }));
  const r = await withTenant(u.tenantId, (tx) => publishRoster(tx, { tenantId: u.tenantId, actorId: u.id, ...b }));
  return { ok: true, ...r };
});
