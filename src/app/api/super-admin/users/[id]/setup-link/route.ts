import { route } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { sendSetupLink } from "@/lib/services/platform-users";

export const POST = route(async (_req, ctx) => {
  const u = await requireApi("tenants:manage", { tenantScoped: false });
  const { id } = await ctx.params;
  const { email } = await sendSetupLink(u.id, id);
  return { ok: true, message: `Setup link emailed to ${email}.` };
});
