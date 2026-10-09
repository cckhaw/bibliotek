/**
 * Spring physics for gesture-driven motion (the apple-design skill, sections 3-6 and 9).
 *
 * Springs are described the way Apple's APIs do it, with two designer-friendly numbers instead of mass/stiffness/damping:
 *   response       seconds for one undamped period. Lower is snappier. It is NOT a duration; settle time emerges.
 *   dampingRatio   1 = critically damped (no overshoot). Below 1 overshoots. Use < 1 only when a gesture carried momentum.
 */
export interface SpringConfig { response: number; dampingRatio: number }
export interface SpringState { x: number; v: number }

/** Advance a spring by dt seconds toward `target` (semi-implicit Euler; call with small dt, see `runSpring`). */
export function stepSpring(s: SpringState, target: number, dt: number, { response, dampingRatio }: SpringConfig): SpringState {
  const w = (2 * Math.PI) / response;
  const a = -w * w * (s.x - target) - 2 * dampingRatio * w * s.v;
  const v = s.v + a * dt;
  return { x: s.x + v * dt, v };
}

/**
 * Where a flick would come to rest if it decelerated like scroll momentum. Apple's exponential-decay form from
 * "Designing Fluid Interfaces" (not v^2/2a). `velocity` in px/s; returns the extra distance in px.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Resistance past a boundary: the further you pull, the less the element follows. Always < overshoot and < dimension. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Run a spring on requestAnimationFrame from the CURRENT value and velocity (never from a logical target), so it can be
 * interrupted at any moment: `stop()` returns the live state to start the next motion from. No input is ever locked out.
 */
export function runSpring(
  from: SpringState, target: number, config: SpringConfig,
  onFrame: (s: SpringState) => void, onDone?: () => void,
): { stop: () => SpringState } {
  let s = { ...from };
  let last = 0;
  let raf = 0;
  const SUB = 1 / 240;
  const frame = (now: number) => {
    // Clamp dt so a backgrounded tab does not fast-forward the physics in one huge step.
    let dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    while (dt > 1e-6) { const h = Math.min(SUB, dt); s = stepSpring(s, target, h, config); dt -= h; }
    const settled = Math.abs(s.x - target) < 0.0005 && Math.abs(s.v) < 0.005;
    if (settled) s = { x: target, v: 0 };
    onFrame(s);
    if (settled) onDone?.(); else raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { stop: () => { cancelAnimationFrame(raf); return s; } };
}
