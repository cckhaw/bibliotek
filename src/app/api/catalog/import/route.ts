import { route } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { importCatalog } from "@/lib/services/catalog-import";

/** POST text/csv (raw body). ?dryRun=1 validates and reports without writing. */
export const POST = route(async (req) => {
  const u = await requireApi("catalog:import");
  const csv = await req.text();
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  return withTenant(u.tenantId, (tx) => importCatalog(tx, { tenantId: u.tenantId, actorId: u.id, csv, dryRun, ip: null }), { timeoutMs: 120_000 });
});
