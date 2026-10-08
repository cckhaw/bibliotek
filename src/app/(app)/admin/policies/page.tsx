import { requirePage } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { ApiForm } from "@/components/ApiForm";
import { ActionButton } from "@/components/ActionButton";
import { Badge, money } from "@/components/ui";

export const metadata = { title: "Policies" };

export default async function Policies() {
  const user = await requirePage("policy:manage");
  const policies = await withTenant(user.tenantId!, (tx) => tx.borrowPolicy.findMany({ orderBy: [{ studentType: "asc" }, { createdAt: "asc" }] }));
  return (
    <>
      <h1 className="h1">Borrowing policies</h1>
      <p className="muted">A student gets the policy matching their <b>student type</b>; if none exists they fall back to the default policy (no type).</p>
      <div className="grid gap-4 md:grid-cols-2">
        {policies.map((p) => (
          <section key={p.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <h2 className="h2 !mb-1">{p.name}</h2>
              <span className="flex gap-1">{p.isDefault && <Badge tone="green">default</Badge>}<Badge tone="gray">{p.studentType ?? "all types"}</Badge></span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="muted">Loan period</dt><dd>{p.freeRentalDays} days</dd>
              <dt className="muted">Max loans</dt><dd>{p.maxLoansPerUser}</dd>
              <dt className="muted">Fine / day</dt><dd>{money(p.dailyFineAmount)} (after {p.gracePeriodDays}d grace){p.maxFinePerLoan ? `, cap ${money(p.maxFinePerLoan)}` : ""}</dd>
              <dt className="muted">Renewals</dt><dd>{p.maxRenewals} × {p.renewalDays} days</dd>
              <dt className="muted">Blocks at</dt><dd>{money(p.fineBlockThreshold)} unpaid</dd>
            </dl>
            {!(p.isDefault && p.studentType == null) && <div className="mt-3"><ActionButton url={`/api/policies/${p.id}`} method="DELETE" label="Delete" variant="danger" confirmText={`Delete policy "${p.name}"?`} /></div>}
          </section>
        ))}
      </div>
      <section className="card">
        <h2 className="h2">Add a policy</h2>
        <ApiForm action="/api/policies" submit="Create policy" fields={[
          { name: "name", label: "Name", required: true, half: true, placeholder: "Postgraduate policy" },
          { name: "studentType", label: "Student type", half: true, placeholder: "e.g. POSTGRAD (blank = default for all)", hint: "Must match the student_type on student records." },
          { name: "freeRentalDays", label: "Free rental days", type: "number", defaultValue: 14, min: 1, required: true, half: true },
          { name: "maxLoansPerUser", label: "Max concurrent loans", type: "number", defaultValue: 5, min: 1, required: true, half: true },
          { name: "dailyFineAmount", label: "Daily fine", type: "number", step: "0.01", defaultValue: 0.5, min: 0, required: true, half: true },
          { name: "gracePeriodDays", label: "Grace days", type: "number", defaultValue: 1, min: 0, required: true, half: true },
          { name: "maxFinePerLoan", label: "Fine cap per loan (optional)", type: "number", step: "0.01", min: 0, half: true },
          { name: "fineBlockThreshold", label: "Block borrowing at unpaid ≥", type: "number", step: "0.01", defaultValue: 10, min: 0, required: true, half: true, hint: "0 disables blocking." },
          { name: "maxRenewals", label: "Max renewals", type: "number", defaultValue: 1, min: 0, required: true, half: true },
          { name: "renewalDays", label: "Days per renewal", type: "number", defaultValue: 7, min: 1, required: true, half: true },
        ]} />
      </section>
    </>
  );
}
