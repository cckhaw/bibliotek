import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { checkRlsEnforced } from "@/lib/rls-guard";
import { runWithTenant as scope, tenantScopeExtension } from "@/lib/tenant-scope";

// Prisma queries are lazy: await INSIDE the scope, exactly as the application does.
const runWithTenant = <T>(id: string, fn: () => PromiseLike<T>) => scope(id, async () => await fn());

const run = Math.random().toString(36).slice(2, 8);
// OWNER connection: PostgreSQL Row-Level Security does NOT apply to it. This simulates the production misconfiguration,
// so everything below shows what the application-level layer alone guarantees.
const raw = new PrismaClient({ datasourceUrl: process.env.SYSTEM_DATABASE_URL });
const scoped = raw.$extends(tenantScopeExtension);
const appRole = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
let A: string, B: string, bUser: string, bBranch: string;

beforeAll(async () => {
  A = (await raw.tenant.create({ data: { name: "A", code: `iso-a-${run}` } })).id;
  B = (await raw.tenant.create({ data: { name: "B", code: `iso-b-${run}` } })).id;
  await raw.user.create({ data: { tenantId: A, role: "TENANT_ADMIN", email: `a-${run}@x.test`, fullName: "Alex (A)", passwordHash: "!x" } });
  bUser = (await raw.user.create({ data: { tenantId: B, role: "TENANT_ADMIN", email: `b-${run}@x.test`, fullName: "Jimmy (B)", passwordHash: "!x" } })).id;
  bBranch = (await raw.branch.create({ data: { tenantId: B, name: "B main", code: "M" } })).id;
});
afterAll(async () => {
  await raw.tenant.deleteMany({ where: { id: { in: [A, B] } } });
  await raw.$disconnect(); await appRole.$disconnect();
});

describe("database role guard", () => {
  it("flags the owner connection and passes the restricted runtime role", async () => {
    expect(await checkRlsEnforced(raw)).toContain("owns the tables");
    expect(await checkRlsEnforced(appRole)).toBeNull();
  });
});

describe("application-level tenant scoping (works even when the DB role bypasses RLS)", () => {
  it("sanity: the unscoped owner connection really can see both tenants", async () => {
    expect(await raw.user.count({ where: { tenantId: { in: [A, B] } } })).toBe(2);
  });

  it("reads only the current tenant's rows, however the query is written", async () => {
    const staff = await runWithTenant(A, () => scoped.user.findMany({ where: { role: { in: ["TENANT_ADMIN", "LIBRARIAN"] } } }));
    expect(staff.map((u) => u.fullName)).toEqual(["Alex (A)"]); // never "Jimmy (B)"
    expect(await runWithTenant(A, () => scoped.user.count())).toBeGreaterThanOrEqual(1);
    expect(await runWithTenant(A, () => scoped.user.findUnique({ where: { id: bUser } }))).toBeNull();
    expect(await runWithTenant(A, () => scoped.branch.findFirst({ where: { id: bBranch } }))).toBeNull();
    expect(await runWithTenant(A, () => scoped.user.findMany({ where: { OR: [{ tenantId: B }, { email: `b-${run}@x.test` }] } }))).toEqual([]);
  });

  it("cannot update or delete another tenant's rows", async () => {
    const r = await runWithTenant(A, () => scoped.user.updateMany({ where: { id: bUser }, data: { fullName: "hacked" } }));
    expect(r.count).toBe(0);
    await expect(runWithTenant(A, () => scoped.user.update({ where: { id: bUser }, data: { fullName: "hacked" } }))).rejects.toThrow();
    await expect(runWithTenant(A, () => scoped.user.delete({ where: { id: bUser } }))).rejects.toThrow();
    expect((await raw.user.findUniqueOrThrow({ where: { id: bUser } })).fullName).toBe("Jimmy (B)");
  });

  it("stamps new rows with the current tenant and refuses to write for, or move rows to, another tenant", async () => {
    const made = await runWithTenant(A, () => scoped.branch.create({ data: { name: "no tenant given", code: "S1" } as never }));
    expect(made.tenantId).toBe(A);
    await runWithTenant(A, () => scoped.branch.createMany({ data: [{ name: "x", code: "S2" } as never, { name: "y", code: "S3" } as never] }));
    expect((await raw.branch.findMany({ where: { code: { in: ["S2", "S3"] } } })).every((b) => b.tenantId === A)).toBe(true);
    await expect(runWithTenant(A, () => scoped.branch.create({ data: { tenantId: B, name: "evil", code: "E" } }))).rejects.toThrow(/another tenant/);
    await expect(runWithTenant(A, () => scoped.branch.updateMany({ where: { code: "S1" }, data: { tenantId: B } }))).rejects.toThrow(/another tenant/);
  });

  it("refuses tenant data outside withTenant(), and tenant creation from a tenant scope", async () => {
    await expect(scoped.user.findMany()).rejects.toThrow(/outside withTenant/);
    await expect(runWithTenant(A, () => scoped.tenant.create({ data: { name: "x", code: `iso-x-${run}` } }))).rejects.toThrow(/platform/);
    expect((await runWithTenant(A, () => scoped.tenant.findMany())).map((t) => t.id)).toEqual([A]);
  });
});
