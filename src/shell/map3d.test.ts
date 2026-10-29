import test from "node:test";
import assert from "node:assert/strict";
import { makeCam, planeToWorld, project, setCam, RING_SHAPE, PITCH, FOCAL, type Proj, type V3 } from "./proj.ts";
import { sortFarToNear, pickNearest } from "./depth.ts";
import { makeLabelSet, layoutLabels } from "./labels.ts";
import { lookOf, bucketR, rng } from "./bodyKind.ts";
import { clampZoom, zoomAt, pinchScale, ZOOM_MAX, ZOOM_MIN } from "./viewMath.ts";

const close = (a: number, b: number, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} !~ ${b}`);
const P = (): Proj => ({ x: 0, y: 0, d: 0, k: 1 });
const W = (): V3 => ({ x: 0, y: 0, z: 0 });

test("project: origin stays at the origin and k is 1 at depth 0", () => {
  const p = project(makeCam(), 0, 0, 0, P());
  assert.deepEqual([p.x, p.y, p.d, p.k], [0, 0, 0, 1]);
});

test("project: points toward the viewer are nearer, lower on screen and larger", () => {
  const c = makeCam(), near = project(c, 0, 0, 300, P()), far = project(c, 0, 0, -300, P());
  assert.ok(near.d < 0 && far.d > 0);
  assert.ok(near.y > far.y);
  assert.ok(near.k > 1 && far.k < 1);
  close(near.k, FOCAL / (FOCAL + near.d));
});

test("project: top-down pitch shows the plane undistorted, edge-on collapses it", () => {
  const top = project(makeCam(0, Math.PI / 2), 100, 0, 200, P());
  close(top.x, 100); close(top.y, 200); close(top.d, 0);
  const edge = project(makeCam(0, 0), 100, 0, 200, P());
  close(edge.y, 0 * edge.k);
});

test("project: the default pitch flattens a circle to sin(pitch) tall", () => {
  const c = makeCam(0, PITCH), a = project(c, 0, 0, 100, P()), b = project(c, 0, 0, -100, P());
  assert.ok((a.y - b.y) / 2 < 100 * Math.sin(PITCH) * 1.1 && (a.y - b.y) / 2 > 100 * Math.sin(PITCH) * 0.9);
  setCam(c, 0.3, 0.5);
  assert.equal(c.yaw, 0.3);
  close(c.cp, Math.cos(0.5));
});

test("project never yields NaN, even for a point far behind the camera", () => {
  const p = project(makeCam(), 1e6, 1e6, 1e6, P());
  assert.ok([p.x, p.y, p.d, p.k].every(Number.isFinite));
});

test("planeToWorld keeps the radius (before eccentricity) and tilts the plane", () => {
  const w = W();
  for (const ring of Object.keys(RING_SHAPE) as (keyof typeof RING_SHAPE)[]) {
    planeToWorld(ring, 100, 0, w);
    close(Math.hypot(w.x, w.y, w.z), 100); // u axis has no eccentricity
    planeToWorld(ring, 0, 100, w);
    close(Math.hypot(w.x, w.y, w.z), 100 * RING_SHAPE[ring].ecc);
  }
  planeToWorld("media", 0, 0, w);
  assert.deepEqual([w.x, w.y, w.z].map((n) => Math.abs(n)), [0, 0, 0]);
  const hs: number[] = [];
  for (let a = 0; a < 6.3; a += 0.5) { planeToWorld("system", 400 * Math.cos(a), 400 * Math.sin(a), w); hs.push(w.y); }
  assert.ok(Math.max(...hs) > 10 && Math.min(...hs) < -10, "ring leaves the flat plane");
});

test("sortFarToNear orders by depth descending, in place, stable for ties", () => {
  const order = Int32Array.from([0, 1, 2, 3, 4]);
  sortFarToNear(order, [3, -5, 10, 0, 3]);
  assert.deepEqual(Array.from(order), [2, 0, 4, 3, 1]);
  sortFarToNear(order, [3, -5, 10, 0, 3]);
  assert.deepEqual(Array.from(order), [2, 0, 4, 3, 1]);
});

test("pickNearest returns the nearest-depth body among overlapping discs, else -1", () => {
  const cx = [100, 105, 300], cy = [100, 100, 100], rad = [30, 30, 20], depth = [50, -20, 0];
  assert.equal(pickNearest(102, 100, cx, cy, rad, depth, 4), 1); // body 1 is in front
  assert.equal(pickNearest(68, 100, cx, cy, rad, depth, 4), 0); // only body 0 reaches here
  assert.equal(pickNearest(300, 124, cx, cy, rad, depth, 4), 2); // slop
  assert.equal(pickNearest(200, 200, cx, cy, rad, depth, 4), -1);
});

function labels(xs: number[], ys: number[], r = 20, w = 90) {
  const L = makeLabelSet(xs.length);
  xs.forEach((x, i) => { L.x[i] = x; L.y[i] = ys[i]; L.r[i] = r; L.w[i] = w; });
  return L;
}
const rects = (L: ReturnType<typeof labels>) => [...Array(L.n).keys()].filter((i) => L.pick[i] >= 0).map((i) => [L.ox[i], L.oy[i], L.w[i], 15]);
const overlap = (a: number[], b: number[]) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

test("labels: two planets side by side never overlap; the nearer one keeps the preferred spot", () => {
  const L = labels([200, 250], [200, 200]);
  layoutLabels(L, [0, 1], 2, 15, 800, 600);
  assert.equal(L.pick[0], 0);
  const r = rects(L);
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) assert.ok(!overlap(r[i], r[j]));
});

test("labels: a crowd places no overlapping labels, none on a planet disc or off canvas", () => {
  const xs = [100, 130, 160, 190, 220, 250, 280], ys = [100, 110, 100, 110, 100, 110, 100];
  const L = labels(xs, ys, 14, 80);
  layoutLabels(L, [0, 1, 2, 3, 4, 5, 6], 7, 15, 400, 300);
  const r = rects(L), placed = [...Array(L.n).keys()].filter((i) => L.pick[i] >= 0);
  for (let i = 0; i < r.length; i++) {
    assert.ok(r[i][0] >= 0 && r[i][1] >= 0 && r[i][0] + r[i][2] <= 400 && r[i][1] + 15 <= 300);
    for (let j = i + 1; j < r.length; j++) assert.ok(!overlap(r[i], r[j]));
    placed.forEach((p) => {
      const nx = Math.max(r[i][0], Math.min(xs[p], r[i][0] + r[i][2])), ny = Math.max(r[i][1], Math.min(ys[p], r[i][1] + 15));
      assert.ok(Math.hypot(nx - xs[p], ny - ys[p]) >= 14 - 1e-9);
    });
  }
  assert.ok(placed.length >= 3);
});

test("labels: the forced (hovered) label is always shown, and a free spot is kept between frames", () => {
  const L = labels([200, 210], [200, 200]);
  layoutLabels(L, [1], 1, 15, 800, 600, 0);
  assert.equal(L.pick[0], 0);
  const L2 = labels([300], [300]);
  layoutLabels(L2, [0], 1, 15, 800, 600);
  L2.prev[0] = 1;
  layoutLabels(L2, [0], 1, 15, 800, 600);
  assert.equal(L2.pick[0], 1);
  L2.x[0] = -500; // nowhere on canvas -> hidden
  layoutLabels(L2, [0], 1, 15, 800, 600);
  assert.equal(L2.pick[0], -1);
});

test("lookOf: inner rings are planets with atmosphere, outer rings small rocky bodies; deterministic", () => {
  assert.equal(lookOf("hub.a", "daily").atmosphere, true);
  assert.equal(lookOf("hub.a", "security").atmosphere, false);
  assert.equal(lookOf("hub.a", "security").kind, "rocky");
  assert.equal(lookOf("hub.a", "security").ringed, false);
  assert.deepEqual(lookOf("hub.x", "media"), lookOf("hub.x", "media"));
  const kinds = new Set(["hub.a", "hub.b", "hub.c", "hub.d", "hub.e", "hub.f"].map((id) => lookOf(id, "daily").kind));
  assert.ok(kinds.size >= 2);
  const r1 = rng(5), r2 = rng(5);
  assert.equal(r1(), r2());
});

test("bucketR is monotonic, >= r and stable inside a bucket", () => {
  assert.ok(bucketR(30) >= 30 && bucketR(30) < 30 * 1.2 + 1e-6);
  assert.equal(bucketR(30), bucketR(30.5));
  assert.ok(bucketR(60) > bucketR(30));
  assert.ok(Number.isFinite(bucketR(0)));
});

test("zoomAt keeps the point under the cursor fixed and clamps", () => {
  const v = { tx: 300, ty: 200, scale: 1 };
  const wx = (500 - v.tx) / v.scale, wy = (350 - v.ty) / v.scale;
  zoomAt(v, 500, 350, 2);
  close(v.tx + wx * v.scale, 500); close(v.ty + wy * v.scale, 350);
  zoomAt(v, 0, 0, 100);
  assert.equal(v.scale, ZOOM_MAX);
  zoomAt(v, 0, 0, 0.001);
  assert.equal(v.scale, ZOOM_MIN);
  assert.equal(clampZoom(NaN), 1);
  assert.equal(pinchScale(1, 100, 200), 2);
  assert.equal(pinchScale(1.5, 0, 50), 1.5);
});
