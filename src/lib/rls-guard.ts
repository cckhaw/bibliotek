/**
 * Verifies that the RUNTIME database connection really is subject to Row-Level Security.
 * Postgres exempts superusers, roles with BYPASSRLS, and (unless FORCE is set) the table owner from RLS. If the app is
 * pointed at such a role every tenant sees every other tenant's data, silently. We refuse to serve tenant data then.
 */
export interface RlsFacts { role: string; super: boolean; bypass: boolean; owns: boolean; rls_on: boolean; forced: boolean }

export type RlsCode = "RLS_DISABLED" | "RLS_SUPERUSER" | "RLS_BYPASSRLS" | "RLS_OWNER";

/** The specific reason the role is exempt, or null when Row-Level Security applies to it. */
export function rlsExemptCode(f: RlsFacts): RlsCode | null {
  if (!f.rls_on) return "RLS_DISABLED";
  if (f.super) return "RLS_SUPERUSER";
  if (f.bypass) return "RLS_BYPASSRLS";
  if (f.owns && !f.forced) return "RLS_OWNER";
  return null;
}

export function rlsProblem(f: RlsFacts): string | null {
  switch (rlsExemptCode(f)) {
    case "RLS_DISABLED": return "Row-Level Security is not enabled on the database tables. Run the migration 20261008000100_tenant_rls_and_constraints.";
    case "RLS_SUPERUSER": return `the database role "${f.role}" is a superuser, which bypasses Row-Level Security`;
    case "RLS_BYPASSRLS": return `the database role "${f.role}" has the BYPASSRLS attribute, which bypasses Row-Level Security`;
    case "RLS_OWNER": return `the database role "${f.role}" owns the tables (or is a member of the role that does), and table owners bypass Row-Level Security`;
    default: return null;
  }
}

export const RLS_FIX =
  "DATABASE_URL must connect as a plain role such as bibliotek_app that does NOT own the tables and has no BYPASSRLS/superuser " +
  "(only SYSTEM_DATABASE_URL and DATABASE_URL_OWNER should use the owner role). See the README, 'Two database roles'.";

interface Queryable { $queryRaw<T = unknown>(q: TemplateStringsArray, ...v: unknown[]): Promise<T> }

export async function getRlsFacts(client: Queryable): Promise<RlsFacts | null> {
  // pg_has_role(..., 'USAGE') is true for the owner AND for members of the owner role: Postgres exempts both.
  const rows = await client.$queryRaw<RlsFacts[]>`
    SELECT current_user::text AS role, r.rolsuper AS super, r.rolbypassrls AS bypass,
      COALESCE((SELECT pg_has_role(current_user, c.relowner, 'USAGE') FROM pg_class c WHERE c.oid = to_regclass('public.users')), false) AS owns,
      COALESCE((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.users')), false) AS rls_on,
      COALESCE((SELECT c.relforcerowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.users')), false) AS forced
    FROM pg_roles r WHERE r.rolname = current_user`;
  return rows[0] ?? null;
}

export async function checkRlsEnforced(client: Queryable): Promise<string | null> {
  const f = await getRlsFacts(client);
  return f ? rlsProblem(f) : "could not determine the database role";
}

/** Short, secret-free code for the health page: null = restricted (good), otherwise why it is exempt. */
export async function checkRlsCode(client: Queryable): Promise<RlsCode | "UNKNOWN" | null> {
  const f = await getRlsFacts(client);
  return f ? rlsExemptCode(f) : "UNKNOWN";
}
