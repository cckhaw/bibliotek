import { requirePage } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { Empty, fmtDateTime } from "@/components/ui";

export const metadata = { title: "My shifts" };

export default async function MyShifts() {
  const user = await requirePage("roster:read");
  const shifts = await withTenant(user.tenantId!, (tx) =>
    tx.dutyShift.findMany({ where: { librarianId: user.id, publishedAt: { not: null }, endTime: { gte: new Date() } }, orderBy: { startTime: "asc" }, take: 60, include: { branch: { select: { name: true } } } }));
  const byDay = new Map<string, typeof shifts>();
  for (const s of shifts) {
    const k = s.startTime.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  return (
    <>
      <h1 className="h1">My upcoming shifts</h1>
      {shifts.length === 0 ? <Empty>No published shifts coming up.</Empty> : (
        <div className="space-y-3">
          {[...byDay].map(([day, list]) => (
            <section key={day} className="card">
              <h2 className="h2">{day}</h2>
              <ul className="space-y-2">{list.map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-zinc-800">
                  <span className="font-medium">{s.branch.name}</span>
                  <span>{s.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {s.endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {s.notes && <span className="muted w-full">{s.notes}</span>}
                </li>))}</ul>
            </section>
          ))}
        </div>
      )}
      <p className="muted">Times shown in your device&apos;s time zone ({fmtDateTime(new Date()).split(",").pop()?.trim()} now).</p>
    </>
  );
}
