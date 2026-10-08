import { route } from "@/lib/api";
import { requireApi } from "@/lib/auth/session";
import { withTenant } from "@/lib/db";
import { searchCatalog } from "@/lib/services/catalog";

export const GET = route(async (req) => {
  const u = await requireApi("catalog:read");
  const sp = new URL(req.url).searchParams;
  return withTenant(u.tenantId, (tx) =>
    searchCatalog(tx, { q: sp.get("q") ?? undefined, category: sp.get("category") ?? undefined, page: Number(sp.get("page") ?? 1) || 1 }),
  );
});
