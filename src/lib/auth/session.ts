import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, StudentStatus } from "@prisma/client";
import { sysDb } from "../db";
import { AppError, forbidden } from "../errors";
import { COOKIE, SESSION_TTL_S, signSession, verifySession } from "./token";
import { HOME, assertCan, can, type Permission } from "./rbac";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  tenantId: string | null;
  status: StudentStatus;
  tenantName: string | null;
}

export async function startSession(user: { id: string; role: Role; tenantId: string | null }) {
  const token = await signSession({ sub: user.id, role: user.role, tenantId: user.tenantId });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_S,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

async function loadUser(token: string | undefined): Promise<CurrentUser | null> {
  const claims = await verifySession(token);
  if (!claims) return null;
  const u = await sysDb().user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true, email: true, fullName: true, role: true, tenantId: true, status: true,
      tenant: { select: { name: true, isSuspended: true } },
    },
  });
  if (!u || u.status === "SUSPENDED" || u.status === "GRADUATED" || u.status === "PENDING_VERIFICATION") return null;
  if (u.tenant?.isSuspended) return null;
  if (u.role !== claims.role || u.tenantId !== claims.tenantId) return null; // stale token after role change
  return { id: u.id, email: u.email, fullName: u.fullName, role: u.role, tenantId: u.tenantId, status: u.status, tenantName: u.tenant?.name ?? null };
}

/**
 * Verifies the JWT AND reloads the user, so suspending a user/tenant or changing a role takes effect
 * on the very next request instead of when the token expires.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return loadUser((await cookies()).get(COOKIE)?.value);
}

/**
 * Like getCurrentUser, but a backend failure (database down, bad setting) is logged and treated as "signed out".
 * For public pages that must stay up. The cookie is read OUTSIDE the try: cookies() signals "this route is dynamic"
 * to Next by throwing, and swallowing that would break rendering.
 */
export async function getCurrentUserOrNull(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  try {
    return await loadUser(token);
  } catch (e) {
    console.error("[session] could not resolve the current user; treating the visitor as signed out:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** For server components / actions: redirects to login instead of throwing. */
export async function requirePage(perm?: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (perm && !can(user.role, perm)) redirect(HOME[user.role]);
  return user;
}
/** For route handlers: throws AppError (rendered as JSON). Returns a user with a guaranteed tenantId when `tenantScoped`. */
export async function requireApi(perm: Permission): Promise<CurrentUser & { tenantId: string }>;
export async function requireApi(perm: Permission, opts: { tenantScoped: false }): Promise<CurrentUser>;
export async function requireApi(perm: Permission, opts?: { tenantScoped?: boolean }): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in", 401);
  assertCan(user.role, perm);
  if (opts?.tenantScoped !== false && !user.tenantId) throw forbidden("This action requires a tenant account");
  return user;
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
}
