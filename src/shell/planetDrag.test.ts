import { test } from "node:test";
import assert from "node:assert/strict";
import { isDrag, nearestRingPoint, parsePlanetPos, phaseFor } from "./planetDrag.ts";
import { makeCam, planeToWorld, project } from "./proj.ts";
import { RING_PERIOD_S, RING_RADIUS, orbitPos } from "./orbit.ts";
import { RING_PHASE, buildSlots } from "./mapLayout.ts";

const v = { tx: 500, ty: 400, scale: 0.8 };
const screenOf = (ring: "daily" | "media" | "system" | "security", a: number) => {
  const w = planeToWorld(ring, RING_RADIUS[ring] * Math.cos(a), RING_RADIUS[ring] * Math.sin(a), { x: 0, y: 0, z: 0 });
  const p = project(makeCam(), w.x, w.y, w.z, { x: 0, y: 0, d: 0, k: 1 });
  return { x: v.tx + p.x * v.scale, y: v.ty + p.y * v.scale };
};

test("click threshold is 4px", () => {
  assert.equal(isDrag(2, 2), false);
  assert.equal(isDrag(3, 3), true);
});

test("a point on a ring snaps to that ring and angle", () => {
  for (const ring of ["daily", "media", "system", "security"] as const) {
    const p = screenOf(ring, 1.2);
    const r = nearestRingPoint(makeCam(), v, p.x + 3, p.y);
    assert.equal(r.ring, ring);
    assert.ok(Math.abs(r.angle - 1.2) < 0.1, `${ring} ${r.angle}`);
  }
});

test("phaseFor puts the planet at the drop angle now, and it keeps orbiting", () => {
  const t = 123.4, a = 2.5, ring = "media" as const;
  const ph = phaseFor(ring, a, t);
  assert.ok(ph >= 0 && ph < 1);
  const now = orbitPos(ring, ph, 1, t + RING_PHASE[ring] * RING_PERIOD_S[ring], 1, { x: 0, y: 0 });
  assert.ok(Math.abs(Math.atan2(now.y, now.x) - a) < 1e-9);
  const later = orbitPos(ring, ph, 1, t + 10 + RING_PHASE[ring] * RING_PERIOD_S[ring], 1, { x: 0, y: 0 });
  assert.notDeepEqual(later, now);
});

test("parsePlanetPos drops junk; buildSlots applies ring + phase override", () => {
  assert.deepEqual(parsePlanetPos("nope"), {});
  const pos = parsePlanetPos(JSON.stringify({ "hub.a": { ring: "security", phase: 1.25 }, "hub.b": { ring: "moon", phase: 0 } }));
  assert.deepEqual(pos, { "hub.a": { ring: "security", phase: 0.25 } });
  const s = buildSlots([{ id: "hub.a", name: "A", ring: "daily" }, { id: "hub.b", name: "B", ring: "daily" }], pos);
  assert.equal(s.find((x) => x.id === "hub.a")!.ring, "security");
  assert.equal(s.find((x) => x.id === "hub.a")!.phase, 0.25);
  assert.equal(s.find((x) => x.id === "hub.b")!.phase, undefined);
});
