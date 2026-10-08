import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { profileSchema, updateOwnProfile } from "@/lib/services/platform-users";

export const PATCH = route(async (req) => {
  const u = await requireApi("tenants:manage", { tenantScoped: false });
  await updateOwnProfile(u.id, await jsonBody(req, profileSchema));
  return { ok: true, message: "Profile updated." };
});
