import { z } from "zod";
import type { Role } from "@prisma/client";
import { isUniqueViolation, sysDb, withTenant } from "../db";
import { AppError, conflict, notFound } from "../errors";
import { audit } from "../audit";
import { dummyHash, hashPassword, newToken, sha256, verifyPassword } from "../auth/password";
import { enqueueEmails } from "../mail/outbox";
import { invite } from "../mail/templates";
import { assertCapacity } from "./licensing";

export const passwordSchema = z.string().min(10, "Use at least 10 characters").max(200);

// --- Login ----------------------------------------------------------------------------------------------------

/** Naive per-instance throttle. For multi-instance deployments back this with Redis/Upstash (see docs). */
const attempts = new Map<string, { n: number; reset: number }>();
function throttle(key: string, max = 8, windowMs = 15 * 60_000) {
  const now = Date.now();
  const e = attempts.get(key);
  if (!e || e.reset < now) { attempts.set(key, { n: 1, reset: now + windowMs }); return; }
  if (++e.n > max) throw new AppError("RATE_LIMITED", "Too many attempts. Try again later.", 429);
}

export async function login(input: { email: string; password: string; ip?: string | null }) {
  const email = input.email.trim().toLowerCase();
  throttle(`${input.ip ?? "?"}|${email}`);
  const user = await sysDb().user.findUnique({ where: { email }, include: { tenant: { select: { isSuspended: true } } } });

  // Always run a bcrypt compare so timing does not reveal whether the account exists.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !ok) throw new AppError("BAD_CREDENTIALS", "Incorrect email or password", 401);
  if (user.tenant?.isSuspended) throw new AppError("TENANT_SUSPENDED", "This organisation's access is suspended. Contact your administrator.", 403);
  if (user.status === "PENDING_VERIFICATION") throw new AppError("PENDING", "Your registration is awaiting approval by the library", 403);
  if (user.status === "SUSPENDED") throw new AppError("SUSPENDED", "Your account is suspended. Contact the library.", 403);
  if (user.status === "GRADUATED") throw new AppError("GRADUATED", "This account is no longer active", 403);

  attempts.delete(`${input.ip ?? "?"}|${email}`);
  return { id: user.id, role: user.role as Role, tenantId: user.tenantId };
}

// --- Student self-registration ---------------------------------------------------------------------------------

export const registerSchema = z.object({
  tenantCode: z.string().trim().min(1).max(60).toLowerCase(),
  email: z.string().trim().email().max(254).toLowerCase(),
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(200),
  studentId: z.string().trim().min(1).max(64),
  department: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
});

/**
 * Verification rules (per tenant):
 *  - email domain in `allowedEmailDomains`  -> "domain verified"
 *  - domain verified AND autoApproveStudents -> ACTIVE immediately
 *  - otherwise                               -> PENDING_VERIFICATION (librarian approval queue)
 */
export async function registerStudent(input: z.infer<typeof registerSchema>, ip?: string | null) {
  const tenant = await sysDb().tenant.findUnique({ where: { code: input.tenantCode } });
  // Same message for "no such school" and "suspended" so codes cannot be enumerated.
  if (!tenant || tenant.isSuspended) throw new AppError("UNKNOWN_SCHOOL", "School code not recognised", 404);

  const domain = input.email.split("@")[1] ?? "";
  const domainVerified = tenant.allowedEmailDomains.map((d) => d.toLowerCase()).includes(domain);
  const status = domainVerified && tenant.autoApproveStudents ? "ACTIVE" : "PENDING_VERIFICATION";
  const passwordHash = await hashPassword(input.password);

  try {
    await withTenant(tenant.id, async (tx) => {
      await assertCapacity(tx, tenant.id, { students: 1 });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id, role: "STUDENT", status, email: input.email, passwordHash, fullName: input.fullName,
          studentId: input.studentId, department: input.department, phone: input.phone,
        },
      });
      await audit(tx, { tenantId: tenant.id, userId: user.id, ip, action: "STUDENT_REGISTERED", details: { status, domainVerified } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("ALREADY_REGISTERED", "An account with this email or student ID already exists");
    throw e;
  }
  return { status, message: status === "ACTIVE" ? "Account created. You can sign in now." : "Registration received. A librarian will verify your student ID shortly." };
}

// --- Approval queue ------------------------------------------------------------------------------------------

export async function decideRegistration(tenantId: string, actorId: string, userId: string, approve: boolean) {
  return withTenant(tenantId, async (tx) => {
    const u = await tx.user.findFirst({ where: { id: userId, role: "STUDENT", status: "PENDING_VERIFICATION" } });
    if (!u) throw notFound("Pending registration");
    if (approve) await tx.user.update({ where: { id: u.id }, data: { status: "ACTIVE" } });
    else await tx.user.delete({ where: { id: u.id } }); // frees the license seat and the email for a corrected registration
    await audit(tx, { tenantId, userId: actorId, action: approve ? "STUDENT_APPROVED" : "STUDENT_REJECTED", details: { userId: u.id, email: u.email } });
  });
}

// --- Invite / reset tokens -------------------------------------------------------------------------------------

export async function redeemToken(rawToken: string, password: string) {
  passwordSchema.parse(password);
  const tokenHash = sha256(rawToken);
  const db = sysDb();
  const t = await db.passwordToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!t || t.usedAt || t.expiresAt < new Date()) throw new AppError("BAD_TOKEN", "This link is invalid or has expired", 400);
  const passwordHash = await hashPassword(password);
  // Conditional update makes redemption single-use even under concurrent requests.
  const claimed = await db.passwordToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count === 0) throw new AppError("BAD_TOKEN", "This link is invalid or has expired", 400);
  await db.user.update({ where: { id: t.userId }, data: { passwordHash, status: t.user.status === "PENDING_VERIFICATION" ? t.user.status : "ACTIVE" } });
}

/** Staff-created accounts (admin/librarian) get an invite rather than a password chosen by someone else. */
export async function createStaffAccount(tenantId: string, tenantName: string, actorId: string, input: { email: string; fullName: string; role: "LIBRARIAN" | "TENANT_ADMIN" }) {
  return withTenant(tenantId, async (tx) => {
    try {
      const user = await tx.user.create({
        data: { tenantId, role: input.role, email: input.email.toLowerCase(), fullName: input.fullName, passwordHash: `!${newToken()}`, status: "ACTIVE" },
      });
      const raw = newToken();
      await tx.passwordToken.create({ data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
      await enqueueEmails(tx, [{ tenantId, to: user.email, kind: "INVITE", dedupeKey: `invite:${user.id}:${sha256(raw).slice(0, 12)}`, ...invite({ name: user.fullName, school: tenantName, token: raw }) }]);
      await audit(tx, { tenantId, userId: actorId, action: "STAFF_CREATED", details: { userId: user.id, role: input.role } });
      return user;
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("EMAIL_TAKEN", "An account with this email already exists");
      throw e;
    }
  });
}
