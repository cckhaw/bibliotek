import { describe, expect, it } from "vitest";
import { project, rubberband, stepSpring, type SpringState } from "../src/lib/spring";

function simulate(from: SpringState, target: number, cfg: { response: number; dampingRatio: number }, seconds = 3, dt = 1 / 240) {
  let s = from; const xs: number[] = [];
  for (let t = 0; t < seconds; t += dt) { s = stepSpring(s, target, dt, cfg); xs.push(s.x); }
  return { final: s, xs };
}

describe("project (momentum projection)", () => {
  it("uses Apple's exponential-decay form: v/1000 * d / (1 - d)", () => {
    expect(project(1000)).toBeCloseTo(499, 5);        // 1000 px/s -> 499 px of travel at the default rate
    expect(project(-500)).toBeCloseTo(-249.5, 5);     // symmetric for the other direction
    expect(project(0)).toBe(0);
  });
  it("a snappier deceleration rate projects a shorter distance", () => {
    expect(project(1000, 0.99)).toBeLessThan(project(1000, 0.998));
  });
});

describe("rubberband", () => {
  it("is 0 at the boundary, increases monotonically, and never reaches the overshoot or the dimension", () => {
    expect(rubberband(0, 600)).toBe(0);
    let prev = 0;
    for (const o of [10, 50, 100, 300, 1000, 100000]) {
      const r = rubberband(o, 600);
      expect(r).toBeGreaterThan(prev); expect(r).toBeLessThan(o); expect(r).toBeLessThan(600);
      prev = r;
    }
  });
  it("resists more the further you pull (the follow ratio falls)", () => {
    expect(rubberband(400, 600) / 400).toBeLessThan(rubberband(40, 600) / 40);
  });
});

describe("stepSpring", () => {
  it("damping 1.0 settles on the target without overshoot", () => {
    const { final, xs } = simulate({ x: 0, v: 0 }, 1, { response: 0.3, dampingRatio: 1 });
    expect(Math.max(...xs)).toBeLessThanOrEqual(1 + 1e-6);
    expect(final.x).toBeCloseTo(1, 3);
  });
  it("damping 0.8 overshoots, then settles (the momentum feel)", () => {
    const { final, xs } = simulate({ x: 0, v: 0 }, 1, { response: 0.3, dampingRatio: 0.8 });
    expect(Math.max(...xs)).toBeGreaterThan(1.005);
    expect(final.x).toBeCloseTo(1, 3);
  });
  it("a lower response is snappier (reaches 95% sooner)", () => {
    const t95 = (response: number) => { const { xs } = simulate({ x: 0, v: 0 }, 1, { response, dampingRatio: 1 }); return xs.findIndex((x) => x >= 0.95); };
    expect(t95(0.2)).toBeLessThan(t95(0.4));
  });
  it("hands off velocity: the first frame advances by about v*dt more than starting from rest", () => {
    const cfg = { response: 0.3, dampingRatio: 1 }; const dt = 1 / 60;
    const rest = stepSpring({ x: 0, v: 0 }, 1, dt, cfg);
    const thrown = stepSpring({ x: 0, v: 3 }, 1, dt, cfg);
    // Critically damped springs bleed most of the initial velocity within a frame, but it is never ignored:
    expect(thrown.x).toBeGreaterThan(rest.x);
    expect(thrown.v).toBeGreaterThan(rest.v);
    // ...and the thrown element stays ahead of the one that started from rest for the whole approach.
    let a: SpringState = { x: 0, v: 3 }; let b: SpringState = { x: 0, v: 0 };
    for (let i = 0; i < 12; i++) { a = stepSpring(a, 1, dt, cfg); b = stepSpring(b, 1, dt, cfg); expect(a.x).toBeGreaterThan(b.x); }
  });
  it("re-targeting from the live state is continuous: at the instant of reversal position and velocity do not jump", () => {
    const cfg = { response: 0.3, dampingRatio: 1 };
    let s: SpringState = { x: 0, v: 0 };
    for (let i = 0; i < 40; i++) s = stepSpring(s, 1, 1 / 240, cfg);       // heading toward 1, moving fast
    expect(s.v).toBeGreaterThan(1);
    const dt = 1e-5;                                                       // the instant of the reversal
    const after = stepSpring(s, 0, dt, cfg);                               // the user reverses: new target 0
    expect(Math.abs(after.x - s.x)).toBeLessThan(2 * s.v * dt);            // position advances by ~v*dt, no teleport
    expect(Math.abs(after.v - s.v)).toBeLessThan(0.01 * s.v);              // velocity is carried through, not reset to 0
    // and the motion then bends smoothly toward the new target rather than hitting a wall:
    let t = after; let reversedAt = -1;
    for (let i = 0; i < 480; i++) { t = stepSpring(t, 0, 1 / 240, cfg); if (reversedAt < 0 && t.v < 0) reversedAt = i; }
    expect(reversedAt).toBeGreaterThan(0);                                 // it kept going briefly, then turned around
    expect(t.x).toBeCloseTo(0, 2);                                         // and settled on the new target
  });
});
