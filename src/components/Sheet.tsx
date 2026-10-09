"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { project, rubberband, runSpring, type SpringState } from "@/lib/spring";

/**
 * A modal that behaves like a physical object (apple-design skill):
 *  - Phones: a bottom sheet you can grab by its header at any moment, even mid-animation. It follows the finger 1:1 from
 *    where you grabbed it, resists upward pulls (rubber-band), and on release it keeps your velocity: the landing point is
 *    projected from the flick, and the spring continues at the finger's speed, so there is no seam between drag and motion.
 *  - Larger screens: a dialog that grows out of the control that opened it and returns to it, along the same path.
 * One number drives everything: `c`, how closed it is (0 = open, 1 = closed). Every animation starts from the live value
 * and velocity of `c`, so interrupting never jumps. Reduced motion swaps movement for a short cross-fade.
 */
export function Sheet({ open, onClose, title, description, children, originRef, busy = false }: {
  open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode;
  /** The control that opened the sheet; the desktop dialog scales out of it and back into it. */
  originRef?: RefObject<HTMLElement | null>;
  /** While a request is in flight the sheet cannot be dismissed. */
  busy?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const state = useRef<SpringState>({ x: 1, v: 0 });       // x = c (closedness), v = dc/dt (per second)
  const anim = useRef<{ stop: () => SpringState } | null>(null);
  const target = useRef(1);
  const mode = useRef<"sheet" | "dialog">("dialog");
  const reduced = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const busyRef = useRef(busy); busyRef.current = busy;
  const closeRef = useRef(onClose); closeRef.current = onClose;

  /** Write the one value `c` to the DOM. Only transform and opacity change, so it stays on the compositor. */
  const apply = useCallback((c: number) => {
    const p = panel.current, sc = scrim.current; if (!p || !sc) return;
    const open01 = 1 - Math.min(Math.max(c, 0), 1);
    sc.style.opacity = String(open01);
    if (reduced.current) { p.style.transform = "none"; p.style.opacity = String(open01); return; }
    if (mode.current === "sheet") {
      p.style.opacity = "1";
      p.style.transform = `translate3d(0, ${c * p.offsetHeight}px, 0)`;
    } else {
      p.style.opacity = String(open01);
      p.style.transform = `scale(${1 - 0.06 * Math.min(Math.max(c, 0), 1)})`;
    }
  }, []);

  /** Start a spring from the live state toward `to`. Always safe to call mid-flight. */
  const animateTo = useCallback((to: number, dampingRatio: number, response: number, onDone?: () => void) => {
    const live = anim.current?.stop() ?? state.current;
    target.current = to;
    anim.current = runSpring(live, to, { response: reduced.current ? 0.12 : response, dampingRatio },
      (s) => { state.current = s; apply(s.x); }, onDone);
  }, [apply]);

  // Open: mount closed, then spring open. Close: spring closed, then unmount.
  useEffect(() => {
    if (open) {
      returnFocus.current = (document.activeElement as HTMLElement) ?? null;
      reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      mode.current = window.matchMedia("(max-width: 639.98px)").matches ? "sheet" : "dialog";
      setMounted(true);
    } else if (mounted && target.current !== 1) {
      animateTo(1, 1, 0.35, () => setMounted(false));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // After mounting, position at "closed", aim the dialog's origin at the trigger, move focus in, and spring open.
  useEffect(() => {
    if (!mounted || !open) return;
    const p = panel.current; if (!p) return;
    state.current = { x: 1, v: 0 }; apply(1);
    if (mode.current === "dialog" && originRef?.current) {
      const o = originRef.current.getBoundingClientRect(), r = p.getBoundingClientRect();
      p.style.transformOrigin = `${o.left + o.width / 2 - r.left}px ${o.top + o.height / 2 - r.top}px`;
    }
    animateTo(0, 1, 0.4);
    (p.querySelector<HTMLElement>("[data-autofocus]") ?? p.querySelector<HTMLElement>("button, input, textarea, select, [href]") ?? p).focus({ preventScroll: true });
    const html = document.documentElement; const prev = html.style.overflow; html.style.overflow = "hidden";
    return () => { html.style.overflow = prev; };
  }, [mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore focus to the trigger once the sheet is gone; stop any running spring on unmount.
  useEffect(() => { if (!mounted && returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true }); }, [mounted]);
  useEffect(() => () => { anim.current?.stop(); }, []);

  function dismiss() { if (!busyRef.current) closeRef.current(); }

  // Keys are handled on the document while the sheet is mounted, so Esc and Tab still work if focus is ever lost to <body>.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); dismiss(); return; }
      if (e.key !== "Tab") return;
      const f = [...(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href]') ?? [])];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], at = document.activeElement;
      if (!panel.current?.contains(at)) { e.preventDefault(); first.focus(); }             // focus escaped: bring it back in
      else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted]);

  // --- Drag (phones). Pointer Events + capture; the grab offset is respected; a short history gives release velocity. ---
  const drag = useRef<{ startY: number; startC: number; id: number; history: { t: number; y: number }[] } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (mode.current !== "sheet" || reduced.current || busyRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    // Interrupt: stop whatever is moving and take over from the live (presentation) value, never the target.
    state.current = anim.current?.stop() ?? state.current; anim.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startC: state.current.x, id: e.pointerId, history: [{ t: performance.now(), y: e.clientY }] };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current; if (!d || e.pointerId !== d.id || !panel.current) return;
    const H = panel.current.offsetHeight;
    const dy = e.clientY - d.startY;                                   // 1:1 with the pointer, relative to where it was grabbed
    const px = d.startC * H + dy;
    const shown = px < 0 ? -rubberband(-px, H) : px;                   // pulling past fully-open resists progressively
    state.current = { x: shown / H, v: 0 }; apply(shown / H);
    const now = performance.now(); d.history.push({ t: now, y: e.clientY });
    while (d.history.length > 2 && now - d.history[0].t > 100) d.history.shift();   // keep ~100ms
  }
  function onPointerEnd(e: React.PointerEvent) {
    const d = drag.current; if (!d || e.pointerId !== d.id || !panel.current) return;
    drag.current = null;
    const H = panel.current.offsetHeight;
    const a = d.history[0], b = d.history[d.history.length - 1];
    const vpx = b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0;    // px/s, positive = down
    const c = state.current.x;
    const projected = c + project(vpx) / H;                             // where a flick would come to rest
    // A decisive flick decides by direction (velocity sign, not position); a slow release goes to the nearer end of the projection.
    const close = e.type !== "pointercancel" && (Math.abs(vpx) > 400 ? vpx > 0 : projected > 0.5);
    state.current = { x: c, v: vpx / H };                               // hand the finger's velocity to the spring
    if (close) { target.current = 1; closeRef.current(); animateTo(1, 1, 0.35, () => setMounted(false)); }
    else animateTo(0, Math.abs(vpx) > 50 ? 0.8 : 1, 0.3);              // a little bounce only because a flick carried momentum
  }

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div ref={root} className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div ref={scrim} aria-hidden onClick={dismiss} className="absolute inset-0 bg-black/45" style={{ opacity: 0 }} />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={description ? `${id}-d` : undefined} tabIndex={-1}
        className="material bg-(--e-bg)/92 relative w-full max-h-[85dvh] overflow-y-auto rounded-t-2xl border border-(--e-rule) pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_48px_-12px_rgb(0_0_0/0.3)] outline-none sm:max-w-md sm:rounded-2xl sm:pb-0 sm:shadow-[0_24px_64px_-16px_rgb(0_0_0/0.4)]"
        style={{ opacity: 0, willChange: "transform, opacity" }}>
        {/* The grab area: the handle and the title. touch-action none so the browser never steals the gesture. */}
        <div className="touch-none select-none px-5 pt-2 sm:cursor-default sm:touch-auto"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
          <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-(--e-muted)/40 sm:hidden" />
          <h2 id={`${id}-t`} className="text-lg font-semibold leading-snug tracking-[-0.01em]">{title}</h2>
          {description && <p id={`${id}-d`} className="muted mt-1">{description}</p>}
        </div>
        <div className="px-5 pb-5 pt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
