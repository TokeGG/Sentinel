import test from "node:test";
import assert from "node:assert/strict";
import { orbitPos, easeSlow, clampSpeed, stepRing, relaxLag, holdTarget, CATCHUP, HOLD_MS, RING_RADIUS, RING_PERIOD_S, EASE_MS } from "./orbit.ts";

const C = { x: 100, y: -50 };
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);
const angle = (p: { x: number; y: number }) => Math.atan2(p.y - C.y, p.x - C.x);
const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

test("ring constants are the brief's values, inner faster than outer", () => {
  assert.deepEqual(RING_RADIUS, { daily: 190, media: 300, system: 410, security: 520 });
  assert.deepEqual(RING_PERIOD_S, { daily: 600, media: 780, system: 960, security: 1200 });
});

test("orbitPos at t=0 spaces planets evenly on the ring", () => {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const p = orbitPos("system", i, n, 0, 1, C);
    close(Math.hypot(p.x - C.x, p.y - C.y), RING_RADIUS.system);
    close(norm(angle(p)), norm((2 * Math.PI * i) / n));
  }
});

test("orbitPos advances one full turn after the ring period", () => {
  for (const ring of ["daily", "media", "system", "security"] as const) {
    const a = orbitPos(ring, 1, 3, 0, 1, C), b = orbitPos(ring, 1, 3, RING_PERIOD_S[ring], 1, C);
    close(a.x, b.x, 1e-6);
    close(a.y, b.y, 1e-6);
    const half = orbitPos(ring, 1, 3, RING_PERIOD_S[ring] / 2, 1, C);
    close(half.x - C.x, -(a.x - C.x), 1e-6); // half a turn = opposite side
  }
});

test("inner ring completes a turn before the outer ring", () => {
  const t = RING_PERIOD_S.daily;
  close(norm(angle(orbitPos("daily", 0, 1, t, 1, C))), 0);
  assert.ok(norm(angle(orbitPos("security", 0, 1, t, 1, C))) > 0.1);
  assert.ok(RING_PERIOD_S.daily < RING_PERIOD_S.media && RING_PERIOD_S.media < RING_PERIOD_S.system);
  assert.ok(RING_PERIOD_S.system < RING_PERIOD_S.security);
});

test("orbitPos with count 0 or non-finite inputs returns the center", () => {
  assert.deepEqual(orbitPos("daily", 0, 0, 10, 1, C), C);
  assert.deepEqual(orbitPos("daily", 0, -2, 10, 1, C), C);
  assert.deepEqual(orbitPos("daily", 0, 3, NaN, 1, C), C);
  assert.deepEqual(orbitPos("daily", 0, 3, 1, Infinity, C), C);
  assert.deepEqual(orbitPos("daily", NaN, 3, 1, 1, C), C);
});

test("orbitPos speed 2 doubles the angular rate", () => {
  const a = orbitPos("media", 0, 1, 37, 2, C), b = orbitPos("media", 0, 1, 74, 1, C);
  close(a.x, b.x);
  close(a.y, b.y);
});

test("easeSlow moves toward the target and settles in about EASE_MS", () => {
  assert.equal(EASE_MS, 300);
  const mid = easeSlow(1, 0, 100);
  assert.ok(mid < 1 && mid > 0);
  let v = 1;
  for (let t = 0; t < EASE_MS; t += 16) v = easeSlow(v, 0, 16);
  assert.ok(v < 0.06, `still ${v}`);
  assert.equal(easeSlow(v, 0, 400), 0); // after a long gap it is exactly there
  assert.ok(easeSlow(0, 1, 100) > 0);
  assert.equal(easeSlow(0.5, 0.5, 16), 0.5);
});

test("easeSlow never overshoots and treats bad input safely", () => {
  assert.equal(easeSlow(1, 0, 1e9), 0);
  assert.equal(easeSlow(0.3, 1, 0), 0.3);
  assert.equal(easeSlow(0.3, 1, -5), 0.3);
  assert.equal(easeSlow(NaN, 1, 16), 1);
  assert.equal(easeSlow(0.3, 1, NaN), 0.3);
});

test("clampSpeed keeps 0.25..2 and falls back to 1", () => {
  assert.equal(clampSpeed(1.5), 1.5);
  assert.equal(clampSpeed(0.1), 0.25);
  assert.equal(clampSpeed(9), 2);
  for (const v of [NaN, Infinity, "2", null, undefined]) assert.equal(clampSpeed(v), 1);
});

test("stepRing integrates clamped dt x speed (a speed change never jumps the clock)", () => {
  assert.equal(stepRing(10, 100, 1), 10.1);
  assert.ok(Math.abs(stepRing(10, 100, 2) - 10.2) < 1e-12);
  assert.equal(stepRing(10, 5000, 1), 10.25); // clamped like advance()
  assert.equal(stepRing(10, -5, 1), 10);
  assert.ok(Math.abs(stepRing(10, 100, 99) - 10.2) < 1e-12); // speed clamped to 2
  // switching speed changes only the rate: the clock is continuous
  let c = 0;
  for (let i = 0; i < 10; i++) c = stepRing(c, 100, 1);
  const before = c;
  c = stepRing(c, 33, 2);
  assert.ok(c - before > 0 && c - before <= 0.066 + 1e-12);
});

test("relaxLag moves monotonically toward 0 at a capped rate and lands exactly on 0", () => {
  assert.equal(CATCHUP, 0.5); // planet runs at most 1.5x its ring's speed while catching up
  assert.ok(Math.abs(relaxLag(5, 200, 1) - 4.9) < 1e-12);
  assert.ok(Math.abs(relaxLag(5, 200, 2) - 4.8) < 1e-12);
  assert.ok(Math.abs(relaxLag(5, 5000, 1) - 4.875) < 1e-12); // dt clamped like advance()
  assert.equal(relaxLag(0.1, 1000, 1), 0); // no overshoot
  assert.equal(relaxLag(-0.1, 1000, 1), 0); // negative lag also relaxes to 0
  assert.ok(Math.abs(relaxLag(-5, 200, 1) + 4.9) < 1e-12);
  assert.equal(relaxLag(NaN, 16, 1), 0);
  assert.equal(relaxLag(3, NaN, 1), 3);
  assert.equal(relaxLag(3, -16, 1), 3);
  let v = 4, prev = v;
  while (v > 0) { v = relaxLag(v, 33, 1); assert.ok(v <= prev && v >= 0); prev = v; }
});

test("holdTarget holds a hovered planet for at most HOLD_MS of pointer stillness", () => {
  assert.equal(HOLD_MS, 4000);
  assert.equal(holdTarget(-1, 0), 1); // not hovering
  assert.equal(holdTarget(100, 0), 0);
  assert.equal(holdTarget(10000, 50), 0); // pointer still moving over it
  assert.equal(holdTarget(3999, 99999), 0); // drifted under a resting pointer: held briefly
  assert.equal(holdTarget(4000, 99999), 1); // ...then released
  assert.equal(holdTarget(20000, 4000), 1);
  assert.equal(holdTarget(NaN, 0), 1);
});
