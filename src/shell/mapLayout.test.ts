import test from "node:test";
import assert from "node:assert/strict";
import { buildSlots, makeScene, stepScene, placeScene, fitView, planetRadius, planetTime, OUTER_EXTENT, RING_PHASE } from "./mapLayout.ts";
import { orbitPos, EASE_MS, RING_RADIUS, RING_PERIOD_S } from "./orbit.ts";
import { hitTest, SUN } from "./mapHit.ts";
import type { ModuleManifest } from "../core/module.ts";

const m = (id: string, ring?: ModuleManifest["ring"], accent?: string) =>
  ({ id, name: id.slice(4), ring, icon: id.slice(4), accent }) as ModuleManifest;
const mods = [m("hub.a", "daily"), m("hub.b", "daily"), m("hub.c"), m("hub.d", "security", "#ff0000")];
const on = { stars: true, orbit: true, speed: 1 };
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test("buildSlots groups by ring (default system) and keeps registry order inside a ring", () => {
  const s = buildSlots(mods);
  assert.deepEqual(s.map((x) => [x.id, x.ring, x.index, x.count]), [
    ["hub.a", "daily", 0, 2], ["hub.b", "daily", 1, 2], ["hub.c", "system", 0, 1], ["hub.d", "security", 0, 1],
  ]);
  assert.equal(s[3].hue, 0);
  assert.equal(s[0].icon, "a");
});

test("stepScene advances stars and the shared orbit clock only for enabled layers", () => {
  const sc = makeScene(buildSlots(mods));
  stepScene(sc, 100, { ...on, orbit: false });
  assert.equal(sc.starT, 0.1);
  assert.equal(sc.orbitT, 0);
  stepScene(sc, 100, { ...on, stars: false });
  assert.equal(sc.starT, 0.1);
  close(sc.orbitT, 0.1);
  stepScene(sc, 100, { ...on, speed: 2 });
  close(sc.orbitT, 0.3);
  stepScene(sc, 5000, on);
  close(sc.orbitT, 0.55); // long gaps clamped like advance()
  assert.ok(sc.lag.every((v) => v === 0));
});

test("planetTime = shared clock + ring phase - lag", () => {
  const sc = makeScene(buildSlots(mods));
  sc.orbitT = 12;
  sc.lag[2] = 3;
  close(planetTime(sc, 2), 12 + RING_PHASE.system * RING_PERIOD_S.system - 3);
});

test("a hovered planet eases to a stop (lag grows) while its ring-mates keep moving", () => {
  const sc = makeScene(buildSlots(mods));
  sc.hover = 1;
  for (let i = 0; i < 30; i++) { sc.idleMs = 0; stepScene(sc, 33, on); }
  assert.equal(sc.slow[1], 0);
  assert.equal(sc.slow[0], 1);
  const held = planetTime(sc, 1), mate = planetTime(sc, 0);
  sc.idleMs = 0;
  stepScene(sc, 33, on);
  close(planetTime(sc, 1), held); // stopped under the pointer
  assert.ok(planetTime(sc, 0) > mate);
});

test("after a 10 s hover and release, the planet drifts back to its even slot in bounded time, never overshooting", () => {
  const sc = makeScene(buildSlots(mods));
  sc.hover = 1;
  for (let t = 0; t < 10000; t += 33) { sc.idleMs = 0; stepScene(sc, 33, on); } // pointer kept moving over it
  assert.ok(sc.lag[1] > 9, `lag ${sc.lag[1]}`);
  sc.hover = -1;
  let t = 0, prev = sc.lag[1];
  while (sc.lag[1] > 0 && t < 60000) {
    const before = planetTime(sc, 1), mate = planetTime(sc, 0);
    stepScene(sc, 33, on);
    // lag may still grow while the slow factor eases back up (first EASE_MS), then only shrinks
    if (t >= EASE_MS) assert.ok(sc.lag[1] <= prev + 1e-9);
    assert.ok(sc.lag[1] >= 0);
    assert.ok(planetTime(sc, 1) - before <= 1.5 * 0.033 + 1e-9); // catch-up capped at 1.5x
    assert.ok(planetTime(sc, 0) - mate > 0);
    prev = sc.lag[1];
    t += 33;
  }
  assert.equal(sc.lag[1], 0);
  assert.ok(t <= 22000, `took ${t} ms`); // ~10 s of lag at 0.5 s/s
  // back in its slot: exactly half a turn from its ring-mate
  const d = (planetTime(sc, 1) - planetTime(sc, 0)) / RING_PERIOD_S.daily;
  close(d, 0);
});

test("a resting pointer holds a planet at most ~4 s", () => {
  const sc = makeScene(buildSlots(mods));
  sc.hover = 0;
  sc.idleMs = 60000; // pointer has not moved for a minute; the planet drifted under it
  for (let t = 0; t < 4000; t += 33) stepScene(sc, 33, on);
  const t0 = planetTime(sc, 0);
  for (let t = 0; t < 1000; t += 33) stepScene(sc, 33, on);
  assert.ok(planetTime(sc, 0) - t0 > 0.5, "planet resumed");
  assert.ok(sc.slow[0] === 1);
});

test("a speed change does not make planets jump", () => {
  const sc = makeScene(buildSlots(mods));
  const v = { tx: 0, ty: 0, scale: 1 };
  stepScene(sc, 33, on);
  placeScene(sc, v);
  const x = sc.sx[0], y = sc.sy[0];
  stepScene(sc, 33, { ...on, speed: 2 });
  placeScene(sc, v);
  const step = Math.hypot(sc.sx[0] - x, sc.sy[0] - y);
  assert.ok(step > 0 && step < (2 * Math.PI * RING_RADIUS.daily * 2 * 0.034) / RING_PERIOD_S.daily, `jumped ${step}`);
});

test("makeScene keeps the clock and each planet's lag across a rebuild", () => {
  const a = makeScene(buildSlots(mods));
  a.orbitT = 50;
  a.lag[2] = 4;
  const b = makeScene(buildSlots([m("hub.z"), ...mods]), a);
  assert.equal(b.orbitT, 50);
  assert.equal(b.slots[3].id, "hub.c");
  assert.equal(b.lag[3], 4);
  assert.equal(b.slots[2].id, "hub.z");
  assert.equal(b.lag[2], 0);
});

test("rings start phase-shifted so the index-0 planets do not line up", () => {
  const sc = makeScene(buildSlots([m("hub.a", "daily"), m("hub.b", "media"), m("hub.c", "system"), m("hub.d", "security")]));
  placeScene(sc, { tx: 0, ty: 0, scale: 1 });
  const ang = [0, 1, 2, 3].map((i) => Math.atan2(sc.sy[i], sc.sx[i]));
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++) assert.ok(Math.abs(ang[i] - ang[j]) > 0.3, `rings ${i} and ${j} aligned`);
});

test("placeScene writes current orbit positions in screen space; hitTest uses them", () => {
  const sc = makeScene(buildSlots(mods));
  sc.orbitT = 300; // a quarter turn of the security ring
  const view = { tx: 640, ty: 420, scale: 0.5 };
  placeScene(sc, view);
  const w = orbitPos("security", 0, 1, planetTime(sc, 3), 1, { x: 0, y: 0 });
  close(sc.sx[3], 640 + w.x * 0.5);
  close(sc.sy[3], 420 + w.y * 0.5);
  const r = planetRadius(view.scale);
  assert.equal(hitTest(sc, sc.sx[3] + r * 0.5, sc.sy[3], r), 3);
  const old = orbitPos("security", 0, 1, RING_PHASE.security * RING_PERIOD_S.security, 1, { x: 0, y: 0 });
  assert.equal(hitTest(sc, 640 + old.x * 0.5, 420 + old.y * 0.5, r), -1); // where it was at t=0
  assert.equal(hitTest(sc, 641, 421, r), SUN);
  assert.equal(hitTest(sc, 5, 5, r), -1);
});

test("fitView shows the whole outer ring with labels in a 1280x800 window", () => {
  for (const [w, h] of [[1280, 800], [900, 600], [1920, 1080]]) {
    const v = fitView(w, h);
    const ext = OUTER_EXTENT * v.scale + planetRadius(v.scale) + 24;
    assert.ok(v.tx - ext >= 0 && v.tx + ext <= w, `x ${w}x${h}`);
    assert.ok(v.ty - ext >= 40 && v.ty + ext <= h, `y ${w}x${h}`);
    assert.ok(planetRadius(v.scale) >= 14);
  }
  assert.deepEqual(fitView(0, 0).scale > 0, true);
});
