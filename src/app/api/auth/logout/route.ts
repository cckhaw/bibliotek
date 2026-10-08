import { route } from "@/lib/api";
import { endSession } from "@/lib/auth/session";

export const POST = route(async () => {
  await endSession();
  return { ok: true, redirect: "/login" };
});
