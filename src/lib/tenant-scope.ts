import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma } from "@prisma/client";

/**
 * Second, independent layer of tenant isolation (the first is PostgreSQL Row-Level Security).
 *
 * Every query on a tenant-owned model made through the runtime client is forced to the tenant of the surrounding
 * `withTenant()` call: reads/updates/deletes get an extra tenant filter, writes get the tenant id stamped on, and
 * attempts to read or write another tenant's id are rejected. A query made outside `withTenant()` is refused.
 * So a forgotten `where: { tenantId }` or a mis-configured database role can no longer expose another school's data.
 */
const store = new AsyncLocalStorage<{ tenantId: string }>();
export const runWithTenant = <T>(tenantId: string, fn: () => T): T => store.run({ tenantId }, fn);

/** Models that carry a `tenantId` column. (`Tenant` itself is scoped by `id`.) */
const TENANT_COLUMN_MODELS = new Set(["Branch", "User", "CatalogItem", "BookCopy", "BorrowPolicy", "Loan", "Fine", "ExtensionRequest", "DutyShift", "AuditLog", "EmailOutbox"]);
const FILTER_OPS = new Set(["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy", "updateMany", "deleteMany"]);
const UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);

type Obj = Record<string, unknown>;

export class TenantScopeError extends Error {}

function stampRow(row: unknown, tenantId: string, what: string): Obj {
  const r = { ...(row as Obj) };
  if (r.tenant !== undefined) return r; // relation-style create; the relation decides (not used by this codebase)
  if (r.tenantId !== undefined && r.tenantId !== tenantId) throw new TenantScopeError(`${what}: refusing to write a row for another tenant`);
  r.tenantId = tenantId;
  return r;
}

export const tenantScopeExtension = Prisma.defineExtension({
  name: "tenantScope",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const isTenant = model === "Tenant";
        if (!isTenant && !TENANT_COLUMN_MODELS.has(model)) return query(args);

        const ctx = store.getStore();
        if (!ctx) throw new TenantScopeError(`${model}.${operation} was called outside withTenant(); tenant data is only reachable inside a tenant scope`);
        const { tenantId } = ctx;
        const col = isTenant ? "id" : "tenantId";
        const what = `${model}.${operation}`;
        const a = { ...((args ?? {}) as Obj) };

        if (isTenant && (operation === "create" || operation === "createMany" || operation === "delete" || operation === "deleteMany")) {
          throw new TenantScopeError(`${what}: tenants are managed by the platform, not from a tenant scope`);
        }

        if (FILTER_OPS.has(operation)) {
          a.where = { AND: [(a.where as Obj | undefined) ?? {}, { [col]: tenantId }] };
        } else if (UNIQUE_OPS.has(operation)) {
          const w = { ...((a.where as Obj | undefined) ?? {}) };
          if (w[col] !== undefined && w[col] !== tenantId) throw new TenantScopeError(`${what}: refusing to target another tenant's row`);
          a.where = { ...w, [col]: tenantId };
        }

        if (!isTenant) {
          if (operation === "create") a.data = stampRow(a.data, tenantId, what);
          if (operation === "upsert") a.create = stampRow(a.create, tenantId, what);
          if (operation === "createMany" || operation === "createManyAndReturn") {
            a.data = Array.isArray(a.data) ? a.data.map((row) => stampRow(row, tenantId, what)) : stampRow(a.data, tenantId, what);
          }
        }
        if ((operation === "update" || operation === "updateMany" || operation === "upsert") && !isTenant) {
          const d = (operation === "upsert" ? a.update : a.data) as Obj | undefined;
          if (d && d.tenantId !== undefined && d.tenantId !== tenantId) throw new TenantScopeError(`${what}: refusing to move a row to another tenant`);
        }
        return query(a as typeof args);
      },
    },
  },
});
