import type { Prisma } from "@prisma/client";
import type { Tx } from "../db";

export interface CatalogQuery { q?: string; category?: string; page?: number; pageSize?: number }

export async function searchCatalog(tx: Tx, { q, category, page = 1, pageSize = 20 }: CatalogQuery) {
  const term = q?.trim();
  const where: Prisma.CatalogItemWhereInput = {
    ...(category ? { category } : {}),
    ...(term
      ? {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { author: { contains: term, mode: "insensitive" } },
            { isbn: { contains: term.replace(/[\s-]/g, "") } },
            { subject: { contains: term, mode: "insensitive" } },
            { deweyCode: { startsWith: term } },
            { lcCode: { startsWith: term, mode: "insensitive" } },
            { tags: { has: term.toLowerCase() } },
          ],
        }
      : {}),
  };
  const [total, rows, categories] = await Promise.all([
    tx.catalogItem.count({ where }),
    tx.catalogItem.findMany({
      where, orderBy: { title: "asc" }, skip: (Math.max(1, page) - 1) * pageSize, take: pageSize,
      include: { copies: { select: { status: true, condition: true, currentBranch: { select: { name: true } } } } },
    }),
    tx.catalogItem.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
  ]);
  const items = rows.map(({ copies, ...i }) => {
    const lendable = copies.filter((c) => c.condition !== "LOST" && c.condition !== "DAMAGED");
    const available = lendable.filter((c) => c.status === "AVAILABLE");
    return { ...i, totalCopies: lendable.length, availableCopies: available.length, availableAt: [...new Set(available.map((c) => c.currentBranch.name))] };
  });
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), categories: categories.map((c) => c.category) };
}
