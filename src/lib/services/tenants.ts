import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { isUniqueViolation, sysDb } from "../db";
import { AppError, conflict, notFound } from "../errors";
import { audit } from "../audit";
import { newToken, sha256, unusablePasswordHash } from "../auth/password";
import { enqueueEmails, flushOutbox } from "../mail/outbox";
import { invite } from "../mail/templates";
import { TIER_PRESETS } from "./licensing";

const code = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "3-40 chars: lowercase letters, digits, hyphens");

export const provisionSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code,
  tier: z.enum(["FREE", "STANDARD", "ENTERPRISE"]).default("STANDARD"),
  adminEmail: z.string().trim().toLowerCase().email(),
  adminName: z.string().trim().min(1).max(200),
  allowedEmailDomains: z.array(z.string().trim().toLowerCase()).default([]),
});

/** Creates tenant + first branch + default policy + first admin (invited by email), atomically. */
export async function provisionTenant(actorId: string, input: z.infer<typeof provisionSchema>) {
  const preset = TIER_PRESETS[input.tier];
  try {
    const tenant = await sysDb().$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: input.name, code: input.code, tier: input.tier, ...preset, allowedEmailDomains: input.allowedEmailDomains },
      });
      await tx.branch.create({ data: { tenantId: tenant.id, name: "Main Library", code: "MAIN" } });
      await tx.borrowPolicy.create({ data: { tenantId: tenant.id, name: "Standard Student Policy" } });
      const admin = await tx.user.create({
        data: { tenantId: tenant.id, role: "TENANT_ADMIN", email: input.adminEmail, fullName: input.adminName, passwordHash: unusablePasswordHash() },
      });
      const raw = newToken();
      await tx.passwordToken.create({ data: { userId: admin.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
      await enqueueEmails(tx, [{ tenantId: tenant.id, to: admin.email, kind: "INVITE", dedupeKey: `invite:${admin.id}:${sha256(raw).slice(0, 12)}`, ...invite({ name: admin.fullName, school: tenant.name, token: raw }) }]);
      await audit(tx, { tenantId: tenant.id, userId: actorId, action: "TENANT_PROVISIONED", details: { code: tenant.code, tier: tenant.tier } });
      return tenant;
    });
    // Deliver the admin's invitation now rather than waiting for the scheduled outbox job.
    await flushOutbox(10).catch((e) => console.error("[invite] immediate send failed; outbox job will retry", e));
    return tenant;
  } catch (e) {
    if (isUniqueViolation(e, "code")) throw conflict("CODE_TAKEN", `School code "${input.code}" is already in use`);
    if (isUniqueViolation(e, "email")) throw conflict("EMAIL_TAKEN", "That admin email already has an account");
    throw e;
  }
}

export const licenseSchema = z.object({
  tier: z.enum(["FREE", "STANDARD", "ENTERPRISE"]).optional(),
  applyTierPreset: z.boolean().optional(),
  maxStudents: z.coerce.number().int().min(0).max(10_000_000).optional(),
  maxBooks: z.coerce.number().int().min(0).max(100_000_000).optional(),
  licenseMode: z.enum(["STUDENTS", "BOOKS", "BOTH"]).optional(),
  isSuspended: z.boolean().optional(),
});

export async function updateLicense(actorId: string, tenantId: string, input: z.infer<typeof licenseSchema>) {
  const data: Prisma.TenantUpdateInput = {};
  if (input.tier) {
    data.tier = input.tier;
    if (input.applyTierPreset) Object.assign(data, TIER_PRESETS[input.tier]);
  }
  // An explicit "reset to plan defaults" wins over any numbers submitted alongside it.
  if (!(input.tier && input.applyTierPreset)) {
    if (input.maxStudents !== undefined) data.maxStudents = input.maxStudents;
    if (input.maxBooks !== undefined) data.maxBooks = input.maxBooks;
  }
  if (input.licenseMode) data.licenseMode = input.licenseMode;
  if (input.isSuspended !== undefined) data.isSuspended = input.isSuspended;
  if (Object.keys(data).length === 0) throw new AppError("NOTHING_TO_UPDATE", "No changes supplied", 400);

  const db = sysDb();
  const before = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!before) throw notFound("Tenant");
  const after = await db.tenant.update({ where: { id: tenantId }, data });
  await db.auditLog.create({ data: { tenantId, userId: actorId, action: "LICENSE_UPDATED", details: { before: pick(before), after: pick(after) } } });
  return after;
}

const pick = (t: { tier: string; maxStudents: number; maxBooks: number; licenseMode: string; isSuspended: boolean }) =>
  ({ tier: t.tier, maxStudents: t.maxStudents, maxBooks: t.maxBooks, licenseMode: t.licenseMode, isSuspended: t.isSuspended });

/** Live counts per tenant (cheap group-bys) joined with the newest telemetry snapshot (storage, 30-day activity). */
export async function listTenantsWithUsage() {
  const db = sysDb();
  const [tenants, students, copies, loans, snaps] = await Promise.all([
    db.tenant.findMany({ orderBy: { createdAt: "desc" } }),
    db.user.groupBy({ by: ["tenantId"], where: { role: "STUDENT", status: { not: "GRADUATED" } }, _count: true }),
    db.bookCopy.groupBy({ by: ["tenantId"], where: { condition: { not: "LOST" } }, _count: true }),
    db.loan.groupBy({ by: ["tenantId"], where: { returnedAt: null }, _count: true }),
    db.usageSnapshot.findMany({ orderBy: { day: "desc" }, distinct: ["tenantId"] }),
  ]);
  const m = (rows: { tenantId: string | null; _count: number }[]) => new Map(rows.map((r) => [r.tenantId, r._count]));
  const [s, c, l] = [m(students), m(copies), m(loans)];
  const snap = new Map(snaps.map((x) => [x.tenantId, x]));
  return tenants.map((t) => ({
    ...t,
    students: s.get(t.id) ?? 0,
    books: c.get(t.id) ?? 0,
    activeLoans: l.get(t.id) ?? 0,
    activeUsers30d: snap.get(t.id)?.activeUsers ?? null,
    storageBytes: snap.get(t.id) ? Number(snap.get(t.id)!.storageBytes) : null,
  }));
}
