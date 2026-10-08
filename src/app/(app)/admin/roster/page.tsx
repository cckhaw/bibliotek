import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { ApiForm } from "@/components/ApiForm";
import { ActionButton } from "@/components/ActionButton";
import { Badge, Empty } from "@/components/ui";

export const metadata = { title: "Roster" };

function mondayOf(s?: string) {
  const d = s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function Roster({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requirePage("roster:manage");
  const start = mondayOf((await searchParams).week);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const prev = new Date(start.getTime() - 7 * 86_400_000);

  const { shifts, branches, staff } = await withTenant(user.tenantId!, async (tx) => ({
    shifts: await tx.dutyShift.findMany({ where: { startTime: { gte: start, lt: end } }, orderBy: { startTime: "asc" }, include: { branch: { select: { name: true } }, librarian: { select: { fullName: true } } } }),
    branches: await tx.branch.findMany({ orderBy: { name: "asc" } }),
    staff: await tx.user.findMany({ where: { role: { in: ["LIBRARIAN", "TENANT_ADMIN"] }, status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
  }));
  const drafts = shifts.filter((s) => !s.publishedAt).length;
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86_400_000));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">Duty roster</h1>
        <div className="flex items-center gap-2">
          <Link className="btn-ghost btn-sm" href={`?week=${iso(prev)}`}>← Prev</Link>
          <span className="text-sm font-medium">Week of {start.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" })}</span>
          <Link className="btn-ghost btn-sm" href={`?week=${iso(end)}`}>Next →</Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton url="/api/roster/publish" body={{ from: start.toISOString(), to: end.toISOString() }} variant="primary"
          label={drafts ? `Publish ${drafts} draft shift${drafts > 1 ? "s" : ""} & notify` : "Nothing to publish"}
          confirmText="Publish this week's drafts? Each affected librarian will be emailed." />
        <span className="muted">Edits to published shifts email the librarian automatically.</span>
      </div>

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((day) => {
          const list = shifts.filter((s) => iso(s.startTime) === iso(day));
          return (
            <section key={day.toISOString()} className="card !p-3">
              <h2 className="mb-2 text-sm font-semibold">{day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", timeZone: "UTC" })}</h2>
              {list.length === 0 ? <p className="muted">—</p> : (
                <ul className="space-y-2">{list.map((s) => (
                  <li key={s.id} className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800">
                    <p className="font-medium">{s.librarian.fullName}</p>
                    <p>{s.startTime.toISOString().slice(11, 16)}–{s.endTime.toISOString().slice(11, 16)} UTC</p>
                    <p className="muted">{s.branch.name}</p>
                    <div className="mt-1 flex items-center gap-2">{s.publishedAt ? <Badge tone="green">published</Badge> : <Badge tone="amber">draft</Badge>}
                      <ActionButton url={`/api/roster/shifts/${s.id}`} method="DELETE" label="✕" confirmText="Delete this shift?" /></div>
                  </li>))}</ul>
              )}
            </section>
          );
        })}
      </div>

      <section className="card">
        <h2 className="h2">Add a shift</h2>
        {staff.length === 0 || branches.length === 0 ? <Empty>Add a branch and at least one librarian first (Settings).</Empty> : (
          <ApiForm action="/api/roster/shifts" submit="Add draft shift" reset={false} fields={[
            { name: "librarianId", label: "Librarian", type: "select", required: true, half: true, options: staff.map((s) => ({ value: s.id, label: s.fullName })) },
            { name: "branchId", label: "Location", type: "select", required: true, half: true, options: branches.map((b) => ({ value: b.id, label: b.name })) },
            { name: "startTime", label: "Starts", type: "datetime-local", required: true, half: true },
            { name: "endTime", label: "Ends", type: "datetime-local", required: true, half: true },
            { name: "notes", label: "Notes", half: false },
          ]} />
        )}
      </section>
    </>
  );
}
