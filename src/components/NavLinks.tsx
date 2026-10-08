"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  // The most specific matching link wins, so /admin does not stay highlighted on /admin/roster.
  const active = items.filter((i) => path === i.href || path.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <>
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active === i.href ? "page" : undefined}
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${active === i.href ? "bg-brand-100 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
          {i.label}
        </Link>
      ))}
    </>
  );
}
