import type { Role } from "@prisma/client";
import { forbidden } from "../errors";

const STAFF: Role[] = ["TENANT_ADMIN", "LIBRARIAN"];
const ALL: Role[] = ["SUPER_ADMIN", "TENANT_ADMIN", "LIBRARIAN", "STUDENT"];

/** Single source of truth for "who may do what". Routes and pages reference permissions, never roles. */
export const PERMISSIONS = {
  "catalog:read": ["TENANT_ADMIN", "LIBRARIAN", "STUDENT"],
  "catalog:write": STAFF,
  "catalog:import": ["TENANT_ADMIN"],
  "students:read": STAFF,
  "students:import": ["TENANT_ADMIN"],
  "students:approve": STAFF,
  "circulation:process": STAFF,
  "circulation:self": ["STUDENT"],
  "extensions:decide": STAFF,
  "fines:manage": STAFF, // pay / waive
  "policy:manage": ["TENANT_ADMIN"],
  "branches:manage": ["TENANT_ADMIN"],
  "roster:manage": ["TENANT_ADMIN"],
  "roster:read": STAFF,
  "audit:read": ["TENANT_ADMIN"],
  "tenants:manage": ["SUPER_ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, perm: Permission): boolean {
  return (PERMISSIONS[perm] as readonly Role[]).includes(role);
}

export function assertCan(role: Role, perm: Permission) {
  if (!can(role, perm)) throw forbidden();
}

/** Where each role lands after login, and which URL prefix it may enter (also enforced in middleware). */
export const HOME: Record<Role, string> = {
  SUPER_ADMIN: "/super-admin",
  TENANT_ADMIN: "/admin",
  LIBRARIAN: "/librarian",
  STUDENT: "/student",
};

export const AREA_ROLES: Record<string, Role[]> = {
  "/super-admin": ["SUPER_ADMIN"],
  "/admin": ["TENANT_ADMIN"],
  "/librarian": ["LIBRARIAN", "TENANT_ADMIN"],
  "/student": ["STUDENT"],
};

export { ALL as ALL_ROLES };
