import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { requestExtension } from "@/lib/services/circulation";

export const POST = route(async (req, ctx) => {
  const u = await requireApi("circulation:self");
  const { id } = await ctx.params;
  const b = await jsonBody(req, z.object({ reason: z.string().max(300).optional() }));
  await withTenant(u.tenantId, (tx) => requestExtension(tx, { tenantId: u.tenantId, userId: u.id, loanId: id, reason: b.reason }));
  return { ok: true, message: "Extension requested. A librarian will review it." };
});
