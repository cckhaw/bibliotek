import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { createStaffAccount } from "@/lib/services/accounts";

export const POST = route(async (req) => {
  const u = await requireApi("branches:manage");
  const b = await jsonBody(req, z.object({ email: z.string().email(), fullName: z.string().trim().min(1).max(200), role: z.enum(["LIBRARIAN", "TENANT_ADMIN"]) }));
  await createStaffAccount(u.tenantId, u.tenantName ?? "your school", u.id, b);
  return { ok: true, message: "Invitation sent." };
});
