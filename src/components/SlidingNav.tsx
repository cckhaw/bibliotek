"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Box = { x: number; y: number; w: number; h: number };
export interface NavItem { href: string; label: string }

/**
 * A nav whose active highlight is ONE element that springs between items, so moving from one destination to the next reads
 * as a single continuous motion. A transition retargeted mid-flight continues from where it currently is. Used for the app's
 * page navigation and for the landing page's scroll-aware section navigation.
 */
export function SlidingNav({ items, active, label, className = "", itemClass, indicatorClass = "rounded-xl bg-[color-mix(in_srgb,var(--tint)_16%,transparent)]" }: {
  items: NavItem[]; active: string | undefined; label: string; className?: string;
  itemClass: (active: boolean) => string; indicatorClass?: string;
}) {
  const root = useRef<HTMLElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [armed, setArmed] = useState(false); // first placement is instant; only later moves animate

  useLayoutEffect(() => {
    const nav = root.current;
    if (!nav) return;
    const measure = () => {
      const el = nav.querySelector<HTMLElement>('[aria-current="page"], [aria-current="location"]');
      setBox(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null);
    };
    measure();
    // On a narrow screen a nav may scroll sideways: bring the current item into view.
    nav.querySelector<HTMLElement>('[aria-current]')?.scrollIntoView({ inline: "center", block: "nearest" });
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [active]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const isAnchor = (href: string) => href.startsWith("#");
  return (
    <nav ref={root} aria-label={label} className={`relative ${className}`}>
      {box && (
        <span aria-hidden data-slide className={`pointer-events-none absolute left-0 top-0 ${indicatorClass}`}
          style={{ width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)`, transitionProperty: armed ? "transform, width" : "none" }} />
      )}
      {items.map((i) => {
        const on = active === i.href;
        const props = { className: `relative ${itemClass(on)}`, "aria-current": on ? (isAnchor(i.href) ? "location" as const : "page" as const) : undefined };
        return isAnchor(i.href)
          ? <a key={i.href} href={i.href} {...props}>{i.label}</a>
          : <Link key={i.href} href={i.href} {...props}>{i.label}</Link>;
      })}
    </nav>
  );
}
