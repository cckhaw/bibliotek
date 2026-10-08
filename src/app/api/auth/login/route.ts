import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { login } from "@/lib/services/accounts";
import { startSession, clientIp } from "@/lib/auth/session";
import { HOME } from "@/lib/auth/rbac";

export const POST = route(async (req) => {
  const body = await jsonBody(req, z.object({ email: z.string().email(), password: z.string().min(1) }));
  const user = await login({ ...body, ip: await clientIp() });
  await startSession(user);
  return { ok: true, redirect: HOME[user.role] };
});
