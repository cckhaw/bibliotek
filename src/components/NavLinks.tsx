"use client";
import { usePathname } from "next/navigation";
import { SlidingNav, type NavItem } from "@/components/SlidingNav";

/** The signed-in app's primary navigation. */
export function NavLinks({ items, className = "" }: { items: NavItem[]; className?: string }) {
  const path = usePathname();
  // The most specific matching link wins, so /admin does not stay highlighted on /admin/roster.
  const active = items.filter((i) => path === i.href || path.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <SlidingNav items={items} active={active} label="Primary" className={className}
      itemClass={(on) => `whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 max-md:flex max-md:min-h-9 max-md:items-center ${on ? "text-(--e-accent)" : "text-(--e-muted) hover:text-(--e-text)"}`} />
  );
}
