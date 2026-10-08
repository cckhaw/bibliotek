import { requirePage } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { ApiForm } from "@/components/ApiForm";
import { Badge, fmtDate } from "@/components/ui";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const user = await requirePage("policy:manage");
  const { tenant, branches, staff } = await withTenant(user.tenantId!, async (tx) => ({
    tenant: await tx.tenant.findUniqueOrThrow({ where: { id: user.tenantId! } }),
    branches: await tx.branch.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { homeCopies: true } } } }),
    staff: await tx.user.findMany({ where: { role: { in: ["LIBRARIAN", "TENANT_ADMIN"] } }, orderBy: { fullName: "asc" } }),
  }));
  return (
    <>
      <h1 className="h1">Settings</h1>

      <section className="card">
        <h2 className="h2">Student registration &amp; reminders</h2>
        <p className="muted mb-3">School code for registration and the public catalog: <code className="font-semibold">{tenant.code}</code> — public catalog at <code>/t/{tenant.code}</code></p>
        <ApiForm action="/api/tenant/settings" method="PUT" reset={false} fields={[
          { name: "allowedEmailDomains", label: "Verified email domains", defaultValue: tenant.allowedEmailDomains.join(", "), placeholder: "students.school.edu, school.edu", hint: "Registrations from these domains count as verified." },
          { name: "autoApproveStudents", label: "Activate verified-domain registrations automatically (others go to the approval queue)", type: "checkbox", defaultValue: tenant.autoApproveStudents },
          { name: "reminderLeadDays", label: "Send due-date reminders this many days ahead", type: "number", min: 0, defaultValue: tenant.reminderLeadDays, half: true },
        ]} submit="Save settings" />
      </section>

      <section className="card">
        <h2 className="h2">Branches</h2>
        <ul className="mb-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {branches.map((b) => <li key={b.id} className="flex justify-between gap-2 py-2"><span><b className="font-medium">{b.name}</b> <Badge tone="gray">{b.code}</Badge>{b.address && <span className="muted"> · {b.address}</span>}</span><span className="muted">{b._count.homeCopies} home copies</span></li>)}
        </ul>
        <ApiForm action="/api/branches" submit="Add branch" fields={[
          { name: "name", label: "Name", required: true, half: true, placeholder: "Science Department Library" },
          { name: "code", label: "Code", required: true, half: true, placeholder: "SCI", hint: "Used as branch_code in book imports." },
          { name: "address", label: "Address (optional)" },
        ]} />
      </section>

      <section className="card">
        <h2 className="h2">Library staff</h2>
        <ul className="mb-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {staff.map((s) => <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2"><span><b className="font-medium">{s.fullName}</b> <span className="muted break-all">{s.email}</span></span><span><Badge tone={s.role === "TENANT_ADMIN" ? "amber" : "gray"}>{s.role.replace("_", " ").toLowerCase()}</Badge> <span className="muted">since {fmtDate(s.createdAt)}</span></span></li>)}
        </ul>
        <ApiForm action="/api/staff" submit="Send invitation" fields={[
          { name: "fullName", label: "Full name", required: true, half: true },
          { name: "email", label: "Email", type: "email", required: true, half: true },
          { name: "role", label: "Role", type: "select", required: true, half: true, options: [{ value: "LIBRARIAN", label: "Librarian" }, { value: "TENANT_ADMIN", label: "School admin" }] },
        ]} />
      </section>
    </>
  );
}
