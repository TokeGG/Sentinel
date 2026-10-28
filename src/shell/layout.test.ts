import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clampToScreen, tile, cascade, dragRect, resizeRect, type Rect } from "./layout.ts";

const S: Rect = { x: 0, y: 0, w: 1000, h: 800 };
const inside = (r: Rect, s: Rect) =>
  r.x >= s.x && r.y >= s.y && r.x + r.w <= s.x + s.w && r.y + r.h <= s.y + s.h;
const finite = (r: Rect) => [r.x, r.y, r.w, r.h].every(Number.isFinite);
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("clampToScreen", () => {
  const min = { w: 200, h: 100 };
  it("moves an off-screen rect inside", () => {
    const r = clampToScreen({ x: 900, y: -50, w: 300, h: 300 }, S, min);
    assert.deepEqual(r, { x: 700, y: 0, w: 300, h: 300 });
  });
  it("grows a rect smaller than min", () => {
    const r = clampToScreen({ x: 10, y: 10, w: 50, h: 20 }, S, min);
    assert.equal(r.w, 200);
    assert.equal(r.h, 100);
  });
  it("shrinks a rect larger than the screen", () => {
    const r = clampToScreen({ x: 5, y: 5, w: 5000, h: 5000 }, S, min);
    assert.deepEqual(r, { x: 0, y: 0, w: 1000, h: 800 });
  });
  it("min larger than screen shrinks min to the screen", () => {
    const r = clampToScreen({ x: 50, y: 50, w: 10, h: 10 }, S, { w: 5000, h: 5000 });
    assert.deepEqual(r, { x: 0, y: 0, w: 1000, h: 800 });
  });
  it("0-size screen gives a zero-size rect at the origin", () => {
    const z: Rect = { x: 7, y: 9, w: 0, h: 0 };
    assert.deepEqual(clampToScreen({ x: 50, y: 50, w: 10, h: 10 }, z, min), { x: 7, y: 9, w: 0, h: 0 });
  });
});

describe("tile", () => {
  it("tile(0) is empty", () => assert.deepEqual(tile(0, S), []));
  it("tile(3) gives 3 non-overlapping rects covering the screen", () => {
    const t = tile(3, S);
    assert.equal(t.length, 3);
    for (let i = 0; i < 3; i++) {
      assert.ok(inside(t[i], S));
      for (let j = i + 1; j < 3; j++) assert.ok(!overlap(t[i], t[j]));
    }
    assert.equal(t.reduce((a, r) => a + r.w * r.h, 0), S.w * S.h);
  });
  it("covers the screen exactly for awkward sizes", () => {
    const s: Rect = { x: 3, y: 4, w: 1001, h: 799 };
    for (const n of [1, 2, 5, 7, 10]) {
      const t = tile(n, s);
      assert.equal(t.length, n);
      assert.equal(t.reduce((a, r) => a + r.w * r.h, 0), s.w * s.h);
      t.forEach((r) => assert.ok(inside(r, s) && finite(r)));
    }
  });
  it("0-size screen has no NaN", () => {
    tile(4, { x: 0, y: 0, w: 0, h: 0 }).forEach((r) => assert.ok(finite(r)));
  });
  it("negative/NaN count is empty", () => {
    assert.deepEqual(tile(-2, S), []);
    assert.deepEqual(tile(NaN, S), []);
  });
});

describe("cascade", () => {
  const size = { w: 400, h: 300 };
  it("cascade(0) is origin + 32", () => {
    assert.deepEqual(cascade(0, S, size), { x: 32, y: 32, w: 400, h: 300 });
  });
  it("stays inside the screen for huge indexes", () => {
    for (const i of [1, 15, 100, 12345, 1e9]) assert.ok(inside(cascade(i, S, size), S));
  });
  it("wraps to origin", () => {
    assert.ok([...Array(40).keys()].some((i) => cascade(i, S, size).x === 0));
  });
  it("oversized window and 0-size screen are safe", () => {
    const r = cascade(5, S, { w: 5000, h: 5000 });
    assert.ok(inside(r, S));
    const z = cascade(3, { x: 0, y: 0, w: 0, h: 0 }, size);
    assert.deepEqual(z, { x: 0, y: 0, w: 0, h: 0 });
  });
});

describe("dragRect / resizeRect", () => {
  const MIN = { w: 240, h: 160 };
  const start: Rect = { x: 100, y: 100, w: 300, h: 200 };
  it("drag moves by the delta", () => {
    assert.deepEqual(dragRect(start, 50, -20, S, MIN), { x: 150, y: 80, w: 300, h: 200 });
  });
  it("drag cannot leave the screen", () => {
    assert.deepEqual(dragRect(start, -5000, -5000, S, MIN), { x: 0, y: 0, w: 300, h: 200 });
    assert.deepEqual(dragRect(start, 5000, 5000, S, MIN), { x: 700, y: 600, w: 300, h: 200 });
  });
  it("resize grows by the delta, keeping position", () => {
    assert.deepEqual(resizeRect(start, 40, 30, S, MIN), { x: 100, y: 100, w: 340, h: 230 });
  });
  it("resize respects min on negative deltas", () => {
    assert.deepEqual(resizeRect(start, -1000, -1000, S, MIN), { x: 100, y: 100, w: 240, h: 160 });
  });
  it("resize cannot exceed the screen", () => {
    const r = resizeRect(start, 5000, 5000, S, MIN);
    assert.ok(inside(r, S));
    assert.deepEqual(r, { x: 100, y: 100, w: 900, h: 700 });
  });
  const S2: Rect = { x: 0, y: 0, w: 1280, h: 800 };
  const near: Rect = { x: 800, y: 100, w: 400, h: 300 };
  it("resize near right edge keeps origin and caps width to remaining room", () => {
    const r = resizeRect(near, 1000, 0, S2, MIN);
    assert.equal(r.w, 480);
    assert.equal(r.x, 800);
  });
  it("resize near bottom edge keeps origin and caps height to remaining room", () => {
    const r = resizeRect(near, 0, 1000, S2, MIN);
    assert.equal(r.h, 700);
    assert.equal(r.y, 100);
  });
  it("resize cannot move the origin", () => {
    assert.deepEqual(resizeRect(near, -1000, -1000, S2, MIN), { x: 800, y: 100, w: 240, h: 160 });
    const tight = resizeRect({ x: 1200, y: 750, w: 80, h: 50 }, -10, -10, S2, MIN);
    assert.deepEqual(tight, { x: 1200, y: 750, w: 80, h: 50 });
  });
});
