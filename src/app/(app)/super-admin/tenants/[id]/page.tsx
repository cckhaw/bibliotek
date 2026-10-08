import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth/session";
import { sysDb } from "@/lib/db";
import { ApiForm } from "@/components/ApiForm";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Meter, Stat, bytes, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Tenant" };

export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("tenants:manage");
  const { id } = await params;
  const db = sysDb();
  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) notFound();
  const [students, books, loans, branches, snaps, audit, admins] = await Promise.all([
    db.user.count({ where: { tenantId: id, role: "STUDENT", status: { not: "GRADUATED" } } }),
    db.bookCopy.count({ where: { tenantId: id, condition: { not: "LOST" } } }),
    db.loan.count({ where: { tenantId: id, returnedAt: null } }),
    db.branch.count({ where: { tenantId: id } }),
    db.usageSnapshot.findMany({ where: { tenantId: id }, orderBy: { day: "desc" }, take: 14 }),
    db.auditLog.findMany({ where: { tenantId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.user.findMany({ where: { tenantId: id, role: "TENANT_ADMIN" }, orderBy: { createdAt: "asc" } }),
  ]);
  const latest = snaps[0];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/super-admin" className="muted underline">← All tenants</Link><h1 className="h1 mt-1">{tenant.name} {tenant.isSuspended && <Badge tone="red">suspended</Badge>}</h1><p className="muted">{tenant.code} · created {fmtDateTime(tenant.createdAt)}</p></div>
        <ActionButton url={`/api/super-admin/tenants/${id}`} method="PATCH" body={{ isSuspended: !tenant.isSuspended }}
          label={tenant.isSuspended ? "Reactivate" : "Suspend access"} variant={tenant.isSuspended ? "primary" : "danger"}
          confirmText={tenant.isSuspended ? undefined : "Suspend this tenant? All of its users are signed out on their next request."} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Branches" value={branches} />
        <Stat label="Checked out now" value={loans} />
        <Stat label="Active users (30d)" value={latest?.activeUsers ?? "—"} sub={latest ? `as of ${latest.day.toISOString().slice(0, 10)}` : "no snapshot yet"} />
        <Stat label="Storage" value={latest ? bytes(Number(latest.storageBytes)) : "—"} />
      </div>
      <section className="card space-y-4">
        <h2 className="h2 !mb-0">License usage</h2>
        <Meter label="Students" used={students} limit={tenant.maxStudents} disabled={tenant.licenseMode === "BOOKS"} />
        <Meter label="Book copies" used={books} limit={tenant.maxBooks} disabled={tenant.licenseMode === "STUDENTS"} />
      </section>
      <section className="card">
        <h2 className="h2">Billing tier &amp; limits</h2>
        <ApiForm action={`/api/super-admin/tenants/${id}`} method="PATCH" reset={false} submit="Update license" fields={[
          { name: "tier", label: "Plan", type: "select", defaultValue: tenant.tier, half: true, options: ["FREE", "STANDARD", "ENTERPRISE"].map((v) => ({ value: v, label: v })) },
          { name: "licenseMode", label: "Enforce", type: "select", defaultValue: tenant.licenseMode, half: true, options: [{ value: "BOTH", label: "Students and books" }, { value: "STUDENTS", label: "Student cap only" }, { value: "BOOKS", label: "Book cap only" }] },
          { name: "maxStudents", label: "Max students", type: "number", min: 0, defaultValue: tenant.maxStudents, half: true },
          { name: "maxBooks", label: "Max book copies", type: "number", min: 0, defaultValue: tenant.maxBooks, half: true },
          { name: "applyTierPreset", label: "Reset limits to the selected plan's defaults (ignores the numbers above)", type: "checkbox" },
        ]} />
        <p className="muted mt-2">Lowering a limit below current usage does not remove data; it blocks further additions until usage drops.</p>
      </section>
      <section className="card space-y-5">
        <div><h2 className="h2 !mb-1">School admins</h2><p className="muted">Fix a mistyped name or email, then send a setup link so they can choose a password. Changes are recorded in the audit trail.</p></div>
        {admins.length === 0 ? <p className="muted">This school has no admin account.</p> : admins.map((a) => (
          <div key={a.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <ApiForm action={`/api/super-admin/users/${a.id}`} method="PATCH" reset={false} submit="Save admin" fields={[
              { name: "fullName", label: "Name", required: true, defaultValue: a.fullName, half: true },
              { name: "email", label: "Email", type: "email", required: true, defaultValue: a.email, half: true },
            ]} />
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <ActionButton url={`/api/super-admin/users/${a.id}/setup-link`} label="Send password setup link" confirmText={`Email a password setup link to ${a.email}?`} />
              <span className="muted">Sent to the email saved above.</span>
            </div>
          </div>
        ))}
      </section>
      <section className="card">
        <h2 className="h2">Usage, last 14 days</h2>
        {snaps.length === 0 ? <p className="muted">Run the telemetry job to populate this.</p> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Day</th><th>Students</th><th>Active</th><th>Copies</th><th>Out</th><th>Open fines</th><th>Storage</th></tr></thead>
            <tbody>{snaps.map((s) => <tr key={s.id}><td>{s.day.toISOString().slice(0, 10)}</td><td>{s.students}</td><td>{s.activeUsers}</td><td>{s.bookCopies}</td><td>{s.activeLoans}</td><td>{Number(s.openFines).toFixed(2)}</td><td>{bytes(Number(s.storageBytes))}</td></tr>)}</tbody></table></div>
        )}
      </section>
      <section className="card">
        <h2 className="h2">Audit trail</h2>
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">{audit.map((a) => <li key={a.id} className="flex justify-between gap-2 py-2"><span>{a.action.replaceAll("_", " ").toLowerCase()}</span><span className="muted">{fmtDateTime(a.createdAt)}</span></li>)}</ul>
      </section>
    </>
  );
}
