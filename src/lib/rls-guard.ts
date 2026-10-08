/**
 * Verifies that the RUNTIME database connection really is subject to Row-Level Security.
 * Postgres exempts superusers, roles with BYPASSRLS, and (unless FORCE is set) the table owner from RLS. If the app is
 * pointed at such a role every tenant sees every other tenant's data, silently. We refuse to serve tenant data then.
 */
export interface RlsFacts { role: string; super: boolean; bypass: boolean; owns: boolean; rls_on: boolean; forced: boolean }

export function rlsProblem(f: RlsFacts): string | null {
  if (!f.rls_on) return "Row-Level Security is not enabled on the database tables. Run the migration 20261008000100_tenant_rls_and_constraints.";
  if (f.super) return `the database role "${f.role}" is a superuser, which bypasses Row-Level Security`;
  if (f.bypass) return `the database role "${f.role}" has the BYPASSRLS attribute, which bypasses Row-Level Security`;
  if (f.owns && !f.forced) return `the database role "${f.role}" owns the tables, and table owners bypass Row-Level Security`;
  return null;
}

export const RLS_FIX =
  "DATABASE_URL must connect as a plain role such as bibliotek_app that does NOT own the tables and has no BYPASSRLS/superuser " +
  "(only SYSTEM_DATABASE_URL and DATABASE_URL_OWNER should use the owner role). See the README, 'Two database roles'.";

interface Queryable { $queryRaw<T = unknown>(q: TemplateStringsArray, ...v: unknown[]): Promise<T> }

export async function checkRlsEnforced(client: Queryable): Promise<string | null> {
  const rows = await client.$queryRaw<RlsFacts[]>`
    SELECT current_user::text AS role, r.rolsuper AS super, r.rolbypassrls AS bypass,
      COALESCE((SELECT o.rolname = current_user FROM pg_class c JOIN pg_roles o ON o.oid = c.relowner WHERE c.oid = to_regclass('public.users')), false) AS owns,
      COALESCE((SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.users')), false) AS rls_on,
      COALESCE((SELECT c.relforcerowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.users')), false) AS forced
    FROM pg_roles r WHERE r.rolname = current_user`;
  const f = rows[0];
  return f ? rlsProblem(f) : "could not determine the database role";
}
