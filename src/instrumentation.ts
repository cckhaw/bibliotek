// Runs once when the server starts (and on each serverless cold start).
export async function register() {
  // Must be a positive check wrapping the import: Next also compiles this file for the Edge runtime,
  // and the bundler can only drop the Node-only code (bcrypt, crypto, Prisma) if it sits inside this branch.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { ensureSuperAdmin } = await import("./lib/bootstrap");
      const result = await ensureSuperAdmin();
      if (result !== "skipped" && result !== "unchanged") console.log(`[bootstrap] super admin ${result}`);
    } catch (e) {
      // Never prevent the app from booting; a bad value or an unreachable DB is reported in the logs.
      console.error("[bootstrap] super admin setup failed:", e instanceof Error ? e.message : e);
    }
  }
}
