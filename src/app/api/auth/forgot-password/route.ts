import { route, jsonBody } from "@/lib/api";
import { forgotSchema, requestPasswordReset } from "@/lib/services/accounts";
import { clientIp } from "@/lib/auth/session";

export const POST = route(async (req) => {
  const { email } = await jsonBody(req, forgotSchema);
  return requestPasswordReset(email, await clientIp());
});
