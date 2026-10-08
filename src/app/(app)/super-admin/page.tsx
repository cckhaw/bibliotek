import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { listTenantsWithUsage } from "@/lib/services/tenants";
import { Badge, Stat, bytes } from "@/components/ui";

export const metadata = { title: "Tenants" };

export default async function SuperAdminHome() {
  await requirePage("tenants:manage");
  const tenants = await listTenantsWithUsage();
  const sum = (f: (t: (typeof tenants)[number]) => number) => tenants.reduce((a, t) => a + f(t), 0);
  const pct = (u: number, l: number) => (l > 0 ? Math.round((u / l) * 100) : 0);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">Platform overview</h1>
        <Link href="/super-admin/tenants/new" className="btn-primary">Provision tenant</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tenants" value={tenants.length} sub={`${tenants.filter((t) => t.isSuspended).length} suspended`} />
        <Stat label="Students" value={sum((t) => t.students).toLocaleString()} />
        <Stat label="Book copies" value={sum((t) => t.books).toLocaleString()} />
        <Stat label="Books checked out" value={sum((t) => t.activeLoans).toLocaleString()} />
      </div>
      <section className="card">
        <div className="table-wrap"><table className="table min-w-[48rem]">
          <thead><tr><th>Tenant</th><th>Plan</th><th>Students</th><th>Books</th><th>Checked out</th><th>Active (30d)</th><th>Storage</th><th /></tr></thead>
          <tbody>{tenants.map((t) => (
            <tr key={t.id}>
              <td><Link className="font-medium text-brand-600 underline" href={`/super-admin/tenants/${t.id}`}>{t.name}</Link><p className="muted">{t.code}</p></td>
              <td><Badge tone={t.tier === "ENTERPRISE" ? "amber" : "gray"}>{t.tier.toLowerCase()}</Badge> {t.isSuspended && <Badge tone="red">suspended</Badge>}</td>
              <td className={pct(t.students, t.maxStudents) >= 90 ? "text-red-600" : ""}>{t.students} / {t.maxStudents}</td>
              <td className={pct(t.books, t.maxBooks) >= 90 ? "text-red-600" : ""}>{t.books} / {t.maxBooks}</td>
              <td>{t.activeLoans}</td><td>{t.activeUsers30d ?? "—"}</td><td>{bytes(t.storageBytes)}</td>
              <td><Link className="btn-ghost btn-sm" href={`/super-admin/tenants/${t.id}`}>Manage</Link></td>
            </tr>))}</tbody>
        </table></div>
      </section>
    </>
  );
}
