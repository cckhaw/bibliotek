import { requirePage } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Empty, fmtDate, money } from "@/components/ui";

export const metadata = { title: "Fines" };

export default async function Fines() {
  const user = await requirePage("fines:manage");
  const fines = await withTenant(user.tenantId!, (tx) =>
    tx.fine.findMany({
      where: { status: "UNPAID" }, orderBy: { amount: "desc" }, take: 200,
      include: { user: { select: { fullName: true, studentId: true } }, loan: { include: { bookCopy: { include: { catalogItem: { select: { title: true } } } } } } },
    }));
  const total = fines.reduce((a, f) => a + Number(f.amount), 0);
  return (
    <>
      <h1 className="h1">Unpaid fines</h1>
      <p className="muted">{fines.length} open · {money(total)} outstanding. Fines keep accruing daily while a book is overdue; waiving requires a reason and is audited.</p>
      <section className="card">
        {fines.length === 0 ? <Empty>No unpaid fines. 🎉</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Student</th><th>Book</th><th>Due</th><th>Days late</th><th>Amount</th><th /></tr></thead>
            <tbody>{fines.map((f) => (
              <tr key={f.id}><td>{f.user.fullName}<p className="muted">{f.user.studentId}</p></td><td>{f.loan.bookCopy.catalogItem.title}{!f.loan.returnedAt && <p><Badge tone="red">still out</Badge></p>}</td>
                <td>{fmtDate(f.loan.dueDate)}</td><td>{f.daysOverdue}</td><td className="font-medium">{money(f.amount)}</td>
                <td className="flex gap-2">
                  <ActionButton url={`/api/fines/${f.id}/pay`} label="Mark paid" variant="primary" confirmText={`Record payment of ${money(f.amount)} from ${f.user.fullName}?`} />
                  <ActionButton url={`/api/fines/${f.id}/waive`} label="Waive…" askReason="Reason for waiving this fine:" />
                </td></tr>))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
