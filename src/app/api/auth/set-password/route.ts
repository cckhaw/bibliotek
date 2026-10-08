import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { redeemToken } from "@/lib/services/accounts";

export const POST = route(async (req) => {
  const b = await jsonBody(req, z.object({ token: z.string().min(10), password: z.string() }));
  await redeemToken(b.token, b.password);
  return { ok: true, message: "Password saved. You can sign in now.", redirect: "/login" };
});
