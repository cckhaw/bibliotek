import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { decideExtension } from "@/lib/services/circulation";

export const POST = route(async (req, ctx) => {
  const u = await requireApi("extensions:decide");
  const { id } = await ctx.params;
  const { approve } = await jsonBody(req, z.object({ approve: z.boolean() }));
  await withTenant(u.tenantId, (tx) => decideExtension(tx, { tenantId: u.tenantId, actorId: u.id, requestId: id, approve }));
  return { ok: true };
});
