"use client";
import { useEffect, useState } from "react";
import { SlidingNav, type NavItem } from "@/components/SlidingNav";

/** The landing page's section links. Highlights the section in the middle of the screen as you scroll, with the same sliding indicator as the app. */
export function SectionNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState<string | undefined>();
  useEffect(() => {
    const els = items.map((i) => document.querySelector<HTMLElement>(i.href)).filter((e): e is HTMLElement => !!e);
    const seen = new Set<string>();
    // A thin band across the middle of the viewport: a section is "current" while it crosses that band.
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) { if (e.isIntersecting) seen.add("#" + e.target.id); else seen.delete("#" + e.target.id); }
      const current = items.filter((i) => seen.has(i.href)).pop();
      setActive((prev) => current?.href ?? (window.scrollY < 200 ? undefined : prev));
    }, { rootMargin: "-45% 0px -50% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);
  return (
    <SlidingNav items={items} active={active} label="Main" className="hidden items-center md:flex"
      indicatorClass="rounded-md bg-black/5 dark:bg-white/10"
      itemClass={(on) => `rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${on ? "text-(--e-text)" : "text-(--e-muted) hover:text-(--e-text)"}`} />
  );
}
