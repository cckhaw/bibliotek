import { z } from "zod";
import { isUniqueViolation, sysDb } from "../db";
import { AppError, conflict, notFound } from "../errors";
import { newToken, sha256, verifyPassword } from "../auth/password";
import { deliverNow, enqueueEmails } from "../mail/outbox";
import { invite } from "../mail/templates";

const email = z.string().trim().toLowerCase().email().max(254);
const name = z.string().trim().min(1).max(200);

export const adminEditSchema = z.object({ fullName: name, email });
export const profileSchema = z.object({ fullName: name, email: email.optional(), currentPassword: z.string().optional() });

/** The env-managed operator's email is owned by SUPERADMIN_EMAIL; editing it here would be undone (or duplicated) at next boot. */
export const isEnvManagedEmail = (e: string) => !!process.env.SUPERADMIN_EMAIL && process.env.SUPERADMIN_EMAIL.trim().toLowerCase() === e.toLowerCase();

/** Platform operator edits a school admin's name/email (e.g. the invite went to a mistyped address). Audited. */
export async function updateTenantAdmin(actorId: string, userId: string, input: z.infer<typeof adminEditSchema>) {
  const db = sysDb();
  const user = await db.user.findFirst({ where: { id: userId, role: "TENANT_ADMIN" } });
  if (!user) throw notFound("School admin");
  if (isEnvManagedEmail(input.email) && input.email !== user.email) throw conflict("EMAIL_RESERVED", "That email is reserved for the platform operator");
  try {
    const updated = await db.user.update({ where: { id: user.id }, data: { fullName: input.fullName, email: input.email } });
    await db.auditLog.create({
      data: { tenantId: user.tenantId, userId: actorId, action: "TENANT_ADMIN_UPDATED", details: { targetUserId: user.id, before: { fullName: user.fullName, email: user.email }, after: { fullName: updated.fullName, email: updated.email } } },
    });
    return updated;
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("EMAIL_TAKEN", "Another account already uses that email");
    throw e;
  }
}

/** Emails a fresh 7-day "choose your password" link (previous unused links are revoked). Throws if the email could not be sent. */
export async function sendSetupLink(actorId: string, userId: string) {
  const db = sysDb();
  const user = await db.user.findFirst({ where: { id: userId, role: "TENANT_ADMIN" }, include: { tenant: { select: { name: true } } } });
  if (!user) throw notFound("School admin");
  const raw = newToken();
  const dedupeKey = `invite:${user.id}:${sha256(raw).slice(0, 12)}`;
  await db.$transaction(async (tx) => {
    await tx.passwordToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordToken.create({ data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 7 * 86_400_000) } });
    await enqueueEmails(tx, [{ tenantId: user.tenantId, to: user.email, kind: "INVITE", dedupeKey, ...invite({ name: user.fullName, school: user.tenant?.name ?? "Bibliotek", token: raw }) }]);
    await tx.auditLog.create({ data: { tenantId: user.tenantId, userId: actorId, action: "SETUP_LINK_SENT", details: { targetUserId: user.id } } });
  });
  const r = await deliverNow(dedupeKey);
  if (!r.sent) {
    throw new AppError("EMAIL_NOT_SENT", `The link was created but the email to ${user.email} could not be sent: ${r.error}. It will be retried automatically once email is fixed.`, 502);
  }
  return { email: user.email };
}

/** The signed-in operator edits their own profile. Changing the email requires the current password. */
export async function updateOwnProfile(userId: string, input: z.infer<typeof profileSchema>) {
  const db = sysDb();
  const me = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const emailChanging = input.email !== undefined && input.email !== me.email;

  if (emailChanging) {
    if (isEnvManagedEmail(me.email)) throw new AppError("EMAIL_MANAGED", "This account's email is set by the SUPERADMIN_EMAIL environment variable. Change it there and redeploy.", 409);
    if (isEnvManagedEmail(input.email!)) throw conflict("EMAIL_RESERVED", "That email is reserved for the environment-managed operator");
    if (!input.currentPassword || !(await verifyPassword(input.currentPassword, me.passwordHash))) throw new AppError("BAD_PASSWORD", "Enter your current password to change your email", 403);
  }
  try {
    await db.user.update({ where: { id: me.id }, data: { fullName: input.fullName, ...(emailChanging ? { email: input.email } : {}) } });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("EMAIL_TAKEN", "Another account already uses that email");
    throw e;
  }
  await db.auditLog.create({ data: { tenantId: null, userId: me.id, action: "OPERATOR_PROFILE_UPDATED", details: { nameChanged: input.fullName !== me.fullName, emailChanged: emailChanging } } });
}
