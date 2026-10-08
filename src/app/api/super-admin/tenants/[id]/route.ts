import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { licenseSchema, updateLicense } from "@/lib/services/tenants";

export const PATCH = route(async (req, ctx) => {
  const u = await requireApi("tenants:manage", { tenantScoped: false });
  const { id } = await ctx.params;
  await updateLicense(u.id, id, await jsonBody(req, licenseSchema));
  return { ok: true };
});
