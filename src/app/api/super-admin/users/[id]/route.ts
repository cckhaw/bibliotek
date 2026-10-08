import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { adminEditSchema, updateTenantAdmin } from "@/lib/services/platform-users";

export const PATCH = route(async (req, ctx) => {
  const u = await requireApi("tenants:manage", { tenantScoped: false });
  const { id } = await ctx.params;
  await updateTenantAdmin(u.id, id, await jsonBody(req, adminEditSchema));
  return { ok: true, message: "Admin updated." };
});
