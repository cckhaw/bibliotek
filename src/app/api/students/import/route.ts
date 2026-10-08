import { route } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { importStudents } from "@/lib/services/student-import";

export const POST = route(async (req) => {
  const u = await requireApi("students:import");
  const csv = await req.text();
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  return withTenant(u.tenantId, (tx) => importStudents(tx, { tenantId: u.tenantId, tenantName: u.tenantName ?? "your school", actorId: u.id, csv, dryRun }), { timeoutMs: 120_000 });
});
