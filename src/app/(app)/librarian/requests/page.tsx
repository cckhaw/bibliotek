import { requirePage } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { Empty, fmtDate } from "@/components/ui";

export const metadata = { title: "Requests" };

export default async function Requests() {
  const user = await requirePage("extensions:decide");
  const { ext, pending } = await withTenant(user.tenantId!, async (tx) => ({
    ext: await tx.extensionRequest.findMany({
      where: { status: "PENDING" }, orderBy: { createdAt: "asc" },
      include: { user: { select: { fullName: true, studentId: true } }, loan: { include: { bookCopy: { include: { catalogItem: { select: { title: true } } } } } } },
    }),
    pending: await tx.user.findMany({ where: { role: "STUDENT", status: "PENDING_VERIFICATION" }, orderBy: { createdAt: "asc" } }),
  }));
  return (
    <>
      <h1 className="h1">Requests</h1>
      <section className="card">
        <h2 className="h2">Student registrations awaiting verification ({pending.length})</h2>
        {pending.length === 0 ? <Empty>No pending registrations.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Name</th><th>Student ID</th><th>Email</th><th>Dept.</th><th>Requested</th><th /></tr></thead>
            <tbody>{pending.map((p) => (
              <tr key={p.id}><td className="font-medium">{p.fullName}</td><td>{p.studentId}</td><td className="break-all">{p.email}</td><td>{p.department ?? "—"}</td><td>{fmtDate(p.createdAt)}</td>
                <td className="flex gap-2">
                  <ActionButton url={`/api/students/${p.id}/decision`} body={{ approve: true }} label="Approve" variant="primary" />
                  <ActionButton url={`/api/students/${p.id}/decision`} body={{ approve: false }} label="Reject" variant="danger" confirmText={`Reject and delete ${p.fullName}'s registration?`} />
                </td></tr>))}</tbody>
          </table></div>
        )}
      </section>
      <section className="card">
        <h2 className="h2">Extension requests ({ext.length})</h2>
        {ext.length === 0 ? <Empty>No pending extension requests.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Student</th><th>Book</th><th>Current due</th><th>Reason</th><th /></tr></thead>
            <tbody>{ext.map((r) => (
              <tr key={r.id}><td>{r.user.fullName}<p className="muted">{r.user.studentId}</p></td><td>{r.loan.bookCopy.catalogItem.title}</td><td>{fmtDate(r.loan.dueDate)}</td><td>{r.reason ?? "—"}</td>
                <td className="flex gap-2">
                  <ActionButton url={`/api/extensions/${r.id}/decision`} body={{ approve: true }} label="Approve" variant="primary" />
                  <ActionButton url={`/api/extensions/${r.id}/decision`} body={{ approve: false }} label="Decline" />
                </td></tr>))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
