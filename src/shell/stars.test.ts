import test from "node:test";
import assert from "node:assert/strict";
import { makeStars, rotate, twinkle } from "./stars.ts";

test("makeStars is deterministic for a seed", () => {
  assert.deepEqual(makeStars(7, 100, 800, 600), makeStars(7, 100, 800, 600));
  assert.notDeepEqual(makeStars(7, 100, 800, 600), makeStars(8, 100, 800, 600));
});
test("stars stay inside the box", () => {
  for (const s of makeStars(3, 500, 800, 600)) {
    assert.ok(s.x >= 0 && s.x <= 800 && s.y >= 0 && s.y <= 600 && s.r > 0);
  }
});
test("layer mix is roughly 60/25/15", () => {
  const n = 4000, c = [0, 0, 0];
  for (const s of makeStars(1, n, 100, 100)) c[s.layer]++;
  assert.ok(Math.abs(c[0] / n - 0.6) < 0.04);
  assert.ok(Math.abs(c[1] / n - 0.25) < 0.04);
  assert.ok(Math.abs(c[2] / n - 0.15) < 0.04);
});
test("rotate by 0 is identity", () => {
  const s = makeStars(1, 1, 100, 100)[0];
  const p = rotate(s, 50, 50, 0, 1);
  assert.ok(Math.abs(p.x - s.x) < 1e-9 && Math.abs(p.y - s.y) < 1e-9);
});
test("rotate by 2π returns to start (within 1e-6)", () => {
  const s = { x: 10, y: 20, r: 1, layer: 0 as const, tw: 0 };
  const q = rotate(s, 50, 50, 2 * Math.PI, 0);
  assert.ok(Math.abs(q.x - s.x) < 1e-6 && Math.abs(q.y - s.y) < 1e-6);
});
test("near layers rotate more than far", () => {
  const s = { x: 90, y: 50, r: 1, layer: 0 as const, tw: 0 };
  const far = rotate(s, 50, 50, 0.5, 0), near = rotate(s, 50, 50, 0.5, 2);
  const ang = (p: { x: number; y: number }) => Math.atan2(p.y - 50, p.x - 50);
  assert.ok(Math.abs(ang(near)) > Math.abs(ang(far)));
});
test("twinkle stays in [0.35, 1]", () => {
  for (const s of makeStars(2, 50, 10, 10)) {
    for (let t = 0; t < 100; t += 0.7) {
      const v = twinkle(s, t);
      assert.ok(v >= 0.35 - 1e-9 && v <= 1 + 1e-9);
    }
  }
});
test("zero count returns empty", () => assert.deepEqual(makeStars(1, 0, 10, 10), []));

import { alphaLevel, advance, STAR_STYLES, GLOW_STYLES, LEVELS, STAR_RGB } from "./stars.ts";

test("alphaLevel quantizes into 0..LEVELS-1 and is monotonic", () => {
  assert.equal(alphaLevel(-1), 0);
  assert.equal(alphaLevel(0), 0);
  assert.equal(alphaLevel(1), LEVELS - 1);
  assert.equal(alphaLevel(5), LEVELS - 1);
  let prev = 0;
  for (let a = 0; a <= 1; a += 0.01) { const l = alphaLevel(a); assert.ok(l >= prev && Number.isInteger(l)); prev = l; }
});
test("style table covers every (color, level)", () => {
  for (const table of [STAR_STYLES, GLOW_STYLES]) {
    assert.equal(table.length, STAR_RGB.length);
    for (const row of table) {
      assert.equal(row.length, LEVELS);
      for (const s of row) assert.match(s, /^rgba\(\d+,\d+,\d+,[01](\.\d+)?\)$/);
      assert.equal(new Set(row).size, LEVELS);
    }
  }
});
test("advance accumulates only while running, ignoring huge gaps", () => {
  assert.equal(advance(1, 500, true), 1.25); // dt clamped to 250 ms
  assert.equal(advance(1, 100, true), 1.1);
  assert.equal(advance(1, 100, false), 1);
  assert.equal(advance(1, -5, true), 1);
});
