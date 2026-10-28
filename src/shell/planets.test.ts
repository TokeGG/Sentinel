import { test } from "node:test";
import assert from "node:assert/strict";
import { planetsFor } from "./planets.ts";
import type { ModuleManifest } from "../core/module.ts";

const mods = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `hub.mod${i}`, name: `M${i}` }) as ModuleManifest);
const size = { w: 1280, h: 800 };

function assertNoOverlap(ps: { x: number; y: number; r: number }[]) {
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y);
      assert.ok(d >= ps[i].r + ps[j].r, `planets ${i} and ${j} overlap`);
    }
}
function assertInside(ps: { x: number; y: number; r: number }[], s = size) {
  for (const p of ps) {
    assert.ok(p.x - p.r >= 0 && p.x + p.r <= s.w, `x out of box: ${p.x}`);
    assert.ok(p.y - p.r >= 0 && p.y + p.r <= s.h, `y out of box: ${p.y}`);
  }
}

test("no_overlap_for_18_modules", () => {
  const ps = planetsFor(mods(18), size);
  assert.equal(ps.length, 18);
  assertNoOverlap(ps);
});

test("same_input_same_output", () => {
  assert.deepEqual(planetsFor(mods(18), size), planetsFor(mods(18), size));
});

test("empty_registry_returns_empty", () => {
  assert.deepEqual(planetsFor([], size), []);
});

test("positions_stay_inside_box_with_radius_margin", () => {
  assertInside(planetsFor(mods(18), size));
});

test("works_for_1_module", () => {
  const ps = planetsFor(mods(1), size);
  assert.equal(ps.length, 1);
  assert.equal(ps[0].id, "hub.mod0");
  assertInside(ps);
});

test("works_for_40_modules", () => {
  const ps = planetsFor(mods(40), size);
  assert.equal(ps.length, 40);
  assertNoOverlap(ps);
  assertInside(ps);
});
