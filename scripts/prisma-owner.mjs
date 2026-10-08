// Runs the Prisma CLI as the table-owner role (migrations/seed need DDL + RLS bypass).
// Usage: node --env-file=.env scripts/prisma-owner.mjs migrate deploy
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL_OWNER ?? process.env.SYSTEM_DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL_OWNER (or SYSTEM_DATABASE_URL) to the owner connection string.");
  process.exit(1);
}
const r = spawnSync("npx", ["prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});
process.exit(r.status ?? 1);
