// Edge-safe (used by middleware): only `jose`, no Node APIs, no DB.
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export const COOKIE = "bib_session";
export const SESSION_TTL_S = 60 * 60 * 8;

export interface SessionClaims {
  sub: string;
  role: Role;
  tenantId: string | null;
}

const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or too short");
  return new TextEncoder().encode(s);
};

export async function signSession(c: SessionClaims): Promise<string> {
  return new SignJWT({ role: c.role, tid: c.tenantId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_S}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: payload.role as Role, tenantId: (payload.tid as string | null) ?? null };
  } catch {
    return null;
  }
}
