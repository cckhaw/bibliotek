import { route, jsonBody } from "@/lib/api";
import { resetPasswordWithOtp, resetSchema } from "@/lib/services/accounts";
import { clientIp } from "@/lib/auth/session";

export const POST = route(async (req) => resetPasswordWithOtp(await jsonBody(req, resetSchema), await clientIp()));
