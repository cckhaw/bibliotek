import { z } from "zod";
import { assertSystemRole, sysDb } from "./db";
import { hashPassword, verifyPassword } from "./auth/password";

const schema = z.object({
  SUPERADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  SUPERADMIN_PASSWORD: z.string().min(12, "SUPERADMIN_PASSWORD must be at least 12 characters"),
  SUPERADMIN_NAME: z.string().trim().min(1).default("Platform Operator"),
});

export type BootstrapResult = "skipped" | "created" | "updated" | "unchanged";

/**
 * Environment-managed platform operator. If SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are set, that account is
 * guaranteed to exist as an ACTIVE SUPER_ADMIN with exactly that password, so rotating the secret = change the
 * variable and redeploy. Idempotent (the bcrypt hash is only rewritten when the password actually changed).
 * Never touches an existing account that belongs to a school (it will not promote or take over a tenant user).
 */
export async function ensureSuperAdmin(source: NodeJS.ProcessEnv = process.env): Promise<BootstrapResult> {
  if (!source.SUPERADMIN_EMAIL && !source.SUPERADMIN_PASSWORD) return "skipped";
  const cfg = schema.parse({
    SUPERADMIN_EMAIL: source.SUPERADMIN_EMAIL,
    SUPERADMIN_PASSWORD: source.SUPERADMIN_PASSWORD,
    SUPERADMIN_NAME: source.SUPERADMIN_NAME || undefined,
  });

  await assertSystemRole();
  const db = sysDb();
  const existing = await db.user.findUnique({ where: { email: cfg.SUPERADMIN_EMAIL } });

  if (!existing) {
    await db.user.create({
      data: { role: "SUPER_ADMIN", tenantId: null, email: cfg.SUPERADMIN_EMAIL, fullName: cfg.SUPERADMIN_NAME, passwordHash: await hashPassword(cfg.SUPERADMIN_PASSWORD), status: "ACTIVE" },
    });
    return "created";
  }
  if (existing.role !== "SUPER_ADMIN" || existing.tenantId !== null) {
    throw new Error(`SUPERADMIN_EMAIL (${cfg.SUPERADMIN_EMAIL}) already belongs to a non-platform account; refusing to modify it`);
  }

  const samePassword = await verifyPassword(cfg.SUPERADMIN_PASSWORD, existing.passwordHash);
  if (samePassword && existing.status === "ACTIVE") return "unchanged";
  await db.user.update({
    where: { id: existing.id },
    data: { status: "ACTIVE", ...(samePassword ? {} : { passwordHash: await hashPassword(cfg.SUPERADMIN_PASSWORD) }) },
  });
  return "updated";
}
