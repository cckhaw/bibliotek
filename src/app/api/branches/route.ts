import { z } from "zod";
import { route, jsonBody } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { isUniqueViolation, withTenant } from "@/lib/db";
import { conflict } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const POST = route(async (req) => {
  const u = await requireApi("branches:manage");
  const b = await jsonBody(req, z.object({
    name: z.string().trim().min(1).max(120),
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{1,20}$/, "Letters, digits, - and _ only"),
    address: z.string().trim().max(300).optional(),
  }));
  try {
    await withTenant(u.tenantId, async (tx) => {
      const br = await tx.branch.create({ data: { tenantId: u.tenantId, ...b, address: b.address || null } });
      await audit(tx, { tenantId: u.tenantId, userId: u.id, action: "BRANCH_CREATED", details: { branchId: br.id } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("CODE_TAKEN", `Branch code "${b.code}" already exists`);
    throw e;
  }
  return { ok: true };
});
