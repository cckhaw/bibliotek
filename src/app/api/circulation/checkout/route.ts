import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { requireApi, clientIp } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { checkout } from "@/lib/services/circulation";

export const POST = route(async (req) => {
  const u = await requireApi("circulation:process");
  const b = await jsonBody(req, z.object({ branchId: z.string().min(1), barcode: z.string().min(1), borrower: z.string().min(1) }));
  const r = await withTenant(u.tenantId, async (tx) => checkout(tx, { tenantId: u.tenantId, actorId: u.id, ip: await clientIp(), ...b }));
  return { ok: true, title: r.title, borrower: r.borrower.fullName, dueDate: r.loan.dueDate };
});
