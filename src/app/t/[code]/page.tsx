import { notFound } from "next/navigation";
import Link from "next/link";
import { sysDb, withTenant } from "@/lib/db";
import { searchCatalog } from "@/lib/services/catalog";
import { CatalogSearch } from "@/components/CatalogSearch";

/** Public, read-only catalogue for a school: /t/<school-code>. No sign-in; only title-level data is exposed. */
export default async function PublicCatalog({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ q?: string; category?: string; page?: string }> }) {
  const { code } = await params;
  const sp = await searchParams;
  const tenant = await sysDb().tenant.findUnique({ where: { code: code.toLowerCase() }, select: { id: true, name: true, isSuspended: true } });
  if (!tenant || tenant.isSuspended) notFound();
  const result = await withTenant(tenant.id, (tx) => searchCatalog(tx, { q: sp.q, category: sp.category, page: Number(sp.page) || 1 }));
  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="h1">{tenant.name} <span className="muted">Library catalog</span></h1>
        <Link className="btn-ghost" href="/login">Sign in</Link>
      </header>
      <CatalogSearch result={result} q={sp.q} category={sp.category} basePath={`/t/${code}`} />
    </main>
  );
}
