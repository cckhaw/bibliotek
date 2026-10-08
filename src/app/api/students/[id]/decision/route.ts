import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { decideRegistration } from "@/lib/services/accounts";

export const POST = route(async (req, ctx) => {
  const u = await requireApi("students:approve");
  const { approve } = await jsonBody(req, z.object({ approve: z.boolean() }));
  await decideRegistration(u.tenantId, u.id, (await ctx.params).id, approve);
  return { ok: true };
});
