"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Box = { x: number; y: number; w: number; h: number };

/**
 * Primary navigation. The active highlight is a single element that springs between items, so moving from one page to
 * another reads as one continuous gesture; a transition retargeted mid-flight continues from where it currently is.
 */
export function NavLinks({ items, className = "" }: { items: { href: string; label: string }[]; className?: string }) {
  const path = usePathname();
  // The most specific matching link wins, so /admin does not stay highlighted on /admin/roster.
  const active = items.filter((i) => path === i.href || path.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const root = useRef<HTMLElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [armed, setArmed] = useState(false); // first placement is instant; only later moves animate

  useLayoutEffect(() => {
    const nav = root.current;
    if (!nav) return;
    const measure = () => {
      const el = nav.querySelector<HTMLElement>('[aria-current="page"]');
      setBox(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null);
    };
    measure();
    // On a narrow screen the nav scrolls sideways: bring the current page into view.
    nav.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [active]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <nav ref={root} aria-label="Primary" className={`relative ${className}`}>
      {box && (
        <span aria-hidden data-slide
          className="pointer-events-none absolute left-0 top-0 rounded-xl bg-[color-mix(in_srgb,var(--tint)_16%,transparent)]"
          style={{ width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)`, transitionProperty: armed ? "transform, width" : "none" }} />
      )}
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active === i.href ? "page" : undefined}
          className={`relative whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 max-md:flex max-md:min-h-9 max-md:items-center ${active === i.href ? "text-(--e-accent)" : "text-(--e-muted) hover:text-(--e-text)"}`}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
