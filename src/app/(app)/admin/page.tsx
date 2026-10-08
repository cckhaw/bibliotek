import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { getUsage } from "@/lib/services/licensing";
import { Meter, Stat, money, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Overview" };

export default async function AdminHome() {
  const user = await requirePage("policy:manage");
  const d = await withTenant(user.tenantId!, async (tx) => {
    const [usage, tenant, active, overdue, fines, pending, recent] = await Promise.all([
      getUsage(tx, user.tenantId!),
      tx.tenant.findUniqueOrThrow({ where: { id: user.tenantId! } }),
      tx.loan.count({ where: { returnedAt: null } }),
      tx.loan.count({ where: { returnedAt: null, dueDate: { lt: new Date() } } }),
      tx.fine.aggregate({ where: { status: "UNPAID" }, _sum: { amount: true } }),
      tx.user.count({ where: { role: "STUDENT", status: "PENDING_VERIFICATION" } }),
      tx.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { fullName: true } } } }),
    ]);
    return { usage, tenant, active, overdue, fines: fines._sum.amount, pending, recent };
  });
  return (
    <>
      <h1 className="h1">{user.tenantName}</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active loans" value={d.active} />
        <Stat label="Overdue" value={d.overdue} tone={d.overdue ? "red" : undefined} />
        <Stat label="Unpaid fines" value={money(d.fines)} />
        <Stat label="Pending sign-ups" value={d.pending} sub={d.pending ? <Link className="text-brand-600 underline" href="/librarian/requests">Review</Link> : undefined} />
      </div>
      <section className="card space-y-4">
        <div className="flex items-center justify-between"><h2 className="h2 !mb-0">License — {d.tenant.tier.toLowerCase()}</h2><span className="muted">Mode: {d.usage.mode.toLowerCase()}</span></div>
        <Meter label="Students" used={d.usage.students} limit={d.usage.maxStudents} disabled={d.usage.mode === "BOOKS"} />
        <Meter label="Book copies" used={d.usage.books} limit={d.usage.maxBooks} disabled={d.usage.mode === "STUDENTS"} />
        <p className="muted">Need more capacity? Contact the platform operator to change your plan.</p>
      </section>
      <section className="card">
        <h2 className="h2">Recent activity</h2>
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {d.recent.map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span><b className="font-medium">{a.action.replaceAll("_", " ").toLowerCase()}</b> {a.user ? `· ${a.user.fullName}` : ""}</span><span className="muted">{fmtDateTime(a.createdAt)}</span></li>)}
        </ul>
      </section>
    </>
  );
}
