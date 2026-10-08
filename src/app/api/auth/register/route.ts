import { route, jsonBody } from "@/lib/api";
import { registerSchema, registerStudent } from "@/lib/services/accounts";
import { clientIp } from "@/lib/auth/session";

export const POST = route(async (req) => registerStudent(await jsonBody(req, registerSchema), await clientIp()));
