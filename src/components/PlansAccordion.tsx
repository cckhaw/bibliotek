"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { gsap } from "gsap";
import { Leaf, Pill } from "@/components/marketing";

import "./PlansAccordion.css";

export interface PlanPanel {
  key: string;
  name: string;
  blurb: string;
  /** Pre-formatted on the server so the markup is identical on the client (no locale hydration mismatch). */
  students: string;
  books: string;
  points: readonly string[];
  badge?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/**
 * An accordion for the plan cards, after React Bits' AccordionGallery: the open plan grows, its neighbours fold and tilt
 * away, and its feature list reveals with a stagger. Nothing important is hidden when a plan is folded (name, blurb and
 * limits stay), so the comparison still reads at a glance. Hover, focus and tap all open a plan; arrow keys move between
 * plans. Every move retargets from the live values, so it can be interrupted and reversed mid-flight.
 */
export function PlansAccordion({
  plans, defaultIndex = 1, expandRatio = 0.52, trigger = "hover", duration = 0.6, ease = "power3.out", tilt = 2, stagger = 0.06,
}: {
  plans: readonly PlanPanel[];
  defaultIndex?: number;
  /** Fraction of the row the open plan occupies (0.2 – 0.9). */
  expandRatio?: number;
  trigger?: "hover" | "click";
  duration?: number;
  ease?: string;
  /** Degrees of 3D rotation on folded plans, easing to flat on the open one. */
  tilt?: number;
  /** Delay between feature rows as they reveal, in seconds. */
  stagger?: number;
}) {
  const count = plans.length;
  const initial = clamp(defaultIndex, 0, count - 1);
  const [active, setActive] = useState(initial);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const features = useRef<(HTMLLIElement | null)[][]>([]);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const firstRun = useRef(true);

  // The share of the row the open plan takes, expressed as a flex-grow against 1 for each folded plan.
  const r = clamp(expandRatio, 0.2, 0.9);
  const grow = count > 1 ? (r * (count - 1)) / (1 - r) : 1;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = firstRun.current || reduced ? 0 : duration;
    firstRun.current = false;

    timeline.current?.kill();
    const tl = gsap.timeline();
    panels.current.forEach((panel, i) => {
      if (!panel) return;
      const isActive = i === active;
      const rot = reduced || isActive ? 0 : i < active ? tilt : -tilt;
      tl.to(panel, { flexGrow: isActive ? grow : 1, rotateY: rot, duration: dur, ease }, 0);

      const rows = (features.current[i] ?? []).filter(Boolean);
      if (isActive) tl.to(rows, { opacity: 1, x: 0, duration: dur, ease, stagger: reduced ? 0 : stagger }, 0);
      else tl.to(rows, { opacity: 0, x: -14, duration: dur * 0.6, ease }, 0);
    });
    timeline.current = tl;
  }, [active, grow, duration, ease, tilt, stagger]);

  useEffect(() => () => { timeline.current?.kill(); }, []);

  function onKeyDown(i: number, e: KeyboardEvent) {
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i + 1) % count
      : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i - 1 + count) % count
      : e.key === "Home" ? 0 : e.key === "End" ? count - 1 : null;
    if (next === null) return;
    e.preventDefault();
    panels.current[next]?.focus(); // focusing opens it (onFocus), so the focus ring and the open plan move together
  }

  return (
    <div className="plans-accordion" role="list" aria-label="Plans">
      {plans.map((p, i) => {
        const isActive = i === active;
        // First paint already matches the initial state, so there is no flash before the animation takes over.
        const open = i === initial;
        const rot = open ? 0 : i < initial ? tilt : -tilt;
        return (
          <div key={p.key} role="listitem" tabIndex={0} aria-current={isActive ? "true" : undefined}
            ref={(el) => { panels.current[i] = el; }}
            className="pa-panel"
            style={{ flexGrow: open ? grow : 1, transform: rot ? `rotateY(${rot}deg)` : undefined }}
            onMouseEnter={() => trigger === "hover" && setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKeyDown(i, e)}>
            <div className="pa-main">
              {p.badge && <span className="mb-3 block w-fit"><Pill tone="moss">{p.badge}</Pill></span>}
              <h3 className="text-2xl font-semibold tracking-[-0.02em]">{p.name}</h3>
              <p className="mt-1 text-sm text-(--e-muted)">{p.blurb}</p>
              <p className="mt-5 text-3xl font-semibold leading-none tracking-[-0.022em] tabular-nums">{p.students}<span className="mt-1 block text-sm font-normal tracking-normal text-(--e-muted)">students</span></p>
              <p className="mt-4 text-3xl font-semibold leading-none tracking-[-0.022em] tabular-nums">{p.books}<span className="mt-1 block text-sm font-normal tracking-normal text-(--e-muted)">book copies</span></p>
            </div>
            <ul className="pa-more space-y-2.5 text-sm text-(--e-muted)">
              {p.points.map((pt, j) => (
                <li key={pt} className="pa-feature flex gap-2.5"
                  ref={(el) => { (features.current[i] ??= [])[j] = el; }}
                  style={open ? undefined : { opacity: 0, transform: "translateX(-14px)" }}>
                  <Leaf className="mt-0.5 size-4 shrink-0 text-(--tint)" /><span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
