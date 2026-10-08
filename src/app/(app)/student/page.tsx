import { requirePage } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { resolvePolicy } from "@/lib/services/policy";
import { toCents, unpaidTotalCents } from "@/lib/services/fines";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Empty, LoanBadge, Stat, fmtDate, money } from "@/components/ui";

export const metadata = { title: "My library" };

export default async function StudentHome() {
  const user = await requirePage("circulation:self");
  const data = await withTenant(user.tenantId!, async (tx) => {
    const me = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    const policy = await resolvePolicy(tx, me.studentType);
    const [loans, fines, unpaid, pending] = await Promise.all([
      tx.loan.findMany({ where: { userId: user.id }, orderBy: { borrowedAt: "desc" }, take: 50, include: { bookCopy: { include: { catalogItem: { select: { title: true, author: true } } } }, checkoutBranch: { select: { name: true } } } }),
      tx.fine.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20, include: { loan: { include: { bookCopy: { include: { catalogItem: { select: { title: true } } } } } } } }),
      unpaidTotalCents(tx, user.id),
      tx.extensionRequest.findMany({ where: { userId: user.id, status: "PENDING" }, select: { loanId: true } }),
    ]);
    return { policy, loans, fines, unpaid, pendingLoanIds: new Set(pending.map((p) => p.loanId)) };
  });
  const open = data.loans.filter((l) => !l.returnedAt);
  const history = data.loans.filter((l) => l.returnedAt);
  const threshold = toCents(data.policy.fineBlockThreshold);
  const blocked = threshold > 0 && data.unpaid >= threshold;

  return (
    <>
      <h1 className="h1">Hello, {user.fullName.split(" ")[0]}</h1>
      {blocked && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">Your borrowing is blocked until unpaid fines drop below {money(threshold / 100)}. Please see a librarian.</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Books on loan" value={`${open.length} / ${data.policy.maxLoansPerUser}`} />
        <Stat label="Unpaid fines" value={money(data.unpaid / 100)} tone={data.unpaid > 0 ? "red" : undefined} sub={`Block at ${money(threshold / 100)}`} />
        <Stat label="Loan period" value={`${data.policy.freeRentalDays} days`} sub={`${money(Number(data.policy.dailyFineAmount))}/day late`} />
      </div>

      <section className="card">
        <h2 className="h2">Current checkouts</h2>
        {open.length === 0 ? <Empty>No books on loan.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Title</th><th>Borrowed</th><th>Due</th><th>Status</th><th /></tr></thead>
            <tbody>{open.map((l) => (
              <tr key={l.id}>
                <td><p className="font-medium">{l.bookCopy.catalogItem.title}</p><p className="muted">{l.bookCopy.catalogItem.author}</p></td>
                <td>{fmtDate(l.borrowedAt)}<p className="muted">{l.checkoutBranch.name}</p></td>
                <td>{fmtDate(l.dueDate)}{l.renewalCount > 0 && <p className="muted">extended ×{l.renewalCount}</p>}</td>
                <td><LoanBadge dueDate={l.dueDate} returnedAt={l.returnedAt} /></td>
                <td>{data.pendingLoanIds.has(l.id) ? <Badge tone="gray">Extension pending</Badge>
                  : l.dueDate > new Date() && l.renewalCount < data.policy.maxRenewals ? <ActionButton url={`/api/loans/${l.id}/extension`} label="Request extension" body={{}} /> : null}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </section>

      <section className="card">
        <h2 className="h2">Fines</h2>
        {data.fines.length === 0 ? <Empty>You have no fines.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Book</th><th>Days late</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{data.fines.map((f) => (
              <tr key={f.id}><td>{f.loan.bookCopy.catalogItem.title}</td><td>{f.daysOverdue}</td><td>{money(f.amount)}</td>
                <td><Badge tone={f.status === "UNPAID" ? "red" : f.status === "PAID" ? "green" : "gray"}>{f.status.toLowerCase()}</Badge>{f.waiveReason && <p className="muted">{f.waiveReason}</p>}</td></tr>))}</tbody>
          </table></div>
        )}
      </section>

      <section className="card">
        <h2 className="h2">Borrowing history</h2>
        {history.length === 0 ? <Empty>Nothing returned yet.</Empty> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Title</th><th>Borrowed</th><th>Returned</th></tr></thead>
            <tbody>{history.map((l) => <tr key={l.id}><td>{l.bookCopy.catalogItem.title}</td><td>{fmtDate(l.borrowedAt)}</td><td>{fmtDate(l.returnedAt)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
