import Link from "next/link";
import type { searchCatalog } from "@/lib/services/catalog";
import { Badge, Empty } from "./ui";

type Result = Awaited<ReturnType<typeof searchCatalog>>;

export function CatalogSearch({ result, q, category, basePath }: { result: Result; q?: string; category?: string; basePath: string }) {
  const href = (page: number) => `${basePath}?${new URLSearchParams({ ...(q ? { q } : {}), ...(category ? { category } : {}), page: String(page) })}`;
  return (
    <div className="space-y-4">
      <form className="card grid gap-3 sm:grid-cols-[1fr_14rem_auto]" role="search">
        <input name="q" defaultValue={q} className="input" placeholder="Title, author, ISBN, subject, Dewey…" aria-label="Search catalog" />
        <select name="category" defaultValue={category ?? ""} className="input" aria-label="Category">
          <option value="">All categories</option>
          {result.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn-primary">Search</button>
      </form>
      <p className="muted">{result.total.toLocaleString()} title{result.total === 1 ? "" : "s"}</p>
      {result.items.length === 0 ? <Empty>No books match your search.</Empty> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {result.items.map((b) => (
            <li key={b.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold leading-snug">{b.title}</h3>
                  <p className="muted">{b.author}</p>
                </div>
                {b.availableCopies > 0 ? <Badge tone="green">{b.availableCopies} available</Badge> : <Badge tone="amber">All on loan</Badge>}
              </div>
              <p className="muted mt-2">
                {b.category}{b.genre ? ` · ${b.genre}` : ""}{b.deweyCode ? ` · DDC ${b.deweyCode}` : ""}{b.lcCode ? ` · LC ${b.lcCode}` : ""}{b.isbn ? ` · ISBN ${b.isbn}` : ""}
              </p>
              {b.availableAt.length > 0 && <p className="muted mt-1">At: {b.availableAt.join(", ")}</p>}
              {b.tags.length > 0 && <p className="mt-2 flex flex-wrap gap-1">{b.tags.map((t) => <span key={t} className="badge-gray">{t}</span>)}</p>}
            </li>
          ))}
        </ul>
      )}
      {result.pages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          {result.page > 1 ? <Link className="btn-ghost" href={href(result.page - 1)}>← Previous</Link> : <span />}
          <span className="muted">Page {result.page} of {result.pages}</span>
          {result.page < result.pages ? <Link className="btn-ghost" href={href(result.page + 1)}>Next →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
