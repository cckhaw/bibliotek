import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { waiveFine } from "@/lib/services/circulation";

export const POST = route(async (req, ctx) => {
  const u = await requireApi("fines:manage");
  const { id } = await ctx.params;
  const { reason } = await jsonBody(req, z.object({ reason: z.string().trim().min(3, "Please give a reason").max(300) }));
  await withTenant(u.tenantId, (tx) => waiveFine(tx, { tenantId: u.tenantId, actorId: u.id, fineId: id, reason }));
  return { ok: true };
});
