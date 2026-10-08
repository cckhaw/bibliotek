import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { provisionSchema, provisionTenant } from "@/lib/services/tenants";

export const POST = route(async (req) => {
  const u = await requireApi("tenants:manage", { tenantScoped: false });
  const t = await provisionTenant(u.id, await jsonBody(req, provisionSchema));
  return { ok: true, id: t.id, redirect: `/super-admin/tenants/${t.id}` };
});
