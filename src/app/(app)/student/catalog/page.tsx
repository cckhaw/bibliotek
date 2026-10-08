import { requirePage } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { searchCatalog } from "@/lib/services/catalog";
import { CatalogSearch } from "@/components/CatalogSearch";

export const metadata = { title: "Catalog" };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; page?: string }> }) {
  const user = await requirePage("catalog:read");
  const sp = await searchParams;
  const result = await withTenant(user.tenantId!, (tx) => searchCatalog(tx, { q: sp.q, category: sp.category, page: Number(sp.page) || 1 }));
  return (
    <>
      <h1 className="h1">Catalog</h1>
      <CatalogSearch result={result} q={sp.q} category={sp.category} basePath="/student/catalog" />
    </>
  );
}
