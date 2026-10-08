import { timingSafeEqual } from "node:crypto";
import { errorResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
import { JOBS, type JobName } from "@/lib/services/jobs";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Scheduler-agnostic job endpoint: Vercel Cron (GET + automatic `Authorization: Bearer $CRON_SECRET`),
 * QStash, GitHub Actions or any cron can call it. Every job is idempotent, so retries are safe.
 */
async function handle(req: Request, ctx: { params: Promise<{ name: string }> }) {
  try {
    const given = Buffer.from(req.headers.get("authorization") ?? "");
    const want = Buffer.from(`Bearer ${env().CRON_SECRET}`);
    if (given.length !== want.length || !timingSafeEqual(given, want)) throw new AppError("UNAUTHORIZED", "Bad cron credentials", 401);
    const { name } = await ctx.params;
    if (!(name in JOBS)) throw new AppError("UNKNOWN_JOB", `Unknown job. Available: ${Object.keys(JOBS).join(", ")}`, 404);
    const result = await JOBS[name as JobName]();
    return Response.json({ job: name, result });
  } catch (e) {
    return errorResponse(e);
  }
}
export { handle as GET, handle as POST };
